from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import DownloadQueue, MediaEntry, LibraryEntry, DownloadPreference, Provider, DuplicateEntry, DownloadRule, CustomList, SessionCookie, Credential
from pydantic import BaseModel
from typing import Optional, Dict, Any
import hashlib
from datetime import datetime
import os
import yt_dlp
from services.media_tagger import MediaTagger
from services.hash_service import HashService
from tasks.download_tasks import real_download_task

from dependencies import verify_api_key
router = APIRouter(prefix="/download", tags=["download"], dependencies=[Depends(verify_api_key)])

class DownloadRequest(BaseModel):
    provider_id: int
    url: str
    metadata: Optional[Dict[str, Any]] = None

def evaluate_rules(db: Session, provider_id: int, metadata: dict):
    rules = db.query(DownloadRule).filter(
        DownloadRule.is_active == True,
        (DownloadRule.scope == 'global') | 
        (DownloadRule.scope == 'session') | 
        (DownloadRule.scope == f'provider:{provider_id}')
    ).all()
    
    for rule in rules:
        criteria = rule.criteria or {}
        match = True
        for key, value in criteria.items():
            if key == "resolution" and metadata.get("resolution") != value:
                match = False
            elif key == "performers":
                if isinstance(value, dict) and "contains" in value:
                    if not any(value["contains"].lower() in p.lower() for p in metadata.get("performers", [])):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in [p.lower() for p in metadata.get("performers", [])]:
                        match = False
            elif key == "categories" or key == "tags":
                if isinstance(value, dict) and "contains" in value:
                    if not any(value["contains"].lower() in t.lower() for t in metadata.get("tags", []) + metadata.get("categories", [])):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in [t.lower() for t in metadata.get("tags", []) + metadata.get("categories", [])]:
                        match = False
            elif key == "series":
                if isinstance(value, dict) and "contains" in value:
                    if value["contains"].lower() not in metadata.get("series", "").lower():
                        match = False
                elif isinstance(value, str):
                    if value.lower() != metadata.get("series", "").lower():
                        match = False
            elif key == "sub_site":
                if value.lower() != metadata.get("sub_site", "").lower():
                    match = False
            elif key == "custom_terms":
                search_text = (metadata.get("title", "") + " " + metadata.get("description", "")).lower()
                if isinstance(value, list):
                    if not any(term.lower() in search_text for term in value):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in search_text:
                        match = False
            elif key == "in_list":
                list_id = value
                custom_list = db.query(CustomList).filter(CustomList.id == list_id).first()
                if custom_list:
                    list_items = [i.lower() for i in custom_list.items]
                    item_type = custom_list.item_type
                    
                    if item_type == "performers":
                        meta_items = [p.lower() for p in metadata.get("performers", [])]
                    elif item_type == "tags" or item_type == "categories":
                        meta_items = [t.lower() for t in metadata.get("tags", []) + metadata.get("categories", [])]
                    elif item_type == "series":
                        meta_items = [metadata.get("series", "").lower()]
                    else:
                        meta_items = [p.lower() for p in metadata.get("performers", [])] + [t.lower() for t in metadata.get("tags", [])]
                    
                    if not any(item in list_items for item in meta_items):
                        match = False
                else:
                    match = False
        
        if match and criteria: # only trigger if there were criteria and they matched
            return rule.action
            
    return "download"

def evaluate_duplicate_quality(db: Session, prefs: DownloadPreference, title: str, meta: dict):
    if prefs and prefs.duplicate_handling != "overwrite":
        existing = db.query(LibraryEntry).filter(LibraryEntry.title.ilike(f"%{title}%")).first()
        if existing:
            resolutions = {"480p": 1, "720p": 2, "1080p": 3, "2K": 4, "4K": 5, "8K": 6}
            existing_res = existing.resolution or "1080p"
            incoming_res = meta.get("resolution", "1080p")
            
            existing_score = resolutions.get(existing_res, 0)
            incoming_score = resolutions.get(incoming_res, 0)
            
            if incoming_score > existing_score and existing_score > 0:
                return {"proceed": True}
            else:
                if prefs.duplicate_handling == "skip":
                    return {"proceed": False, "response": {"message": "Skipped due to duplicate", "duplicate_id": existing.id}}
                elif prefs.duplicate_handling == "ask":
                    return {"proceed": False, "response": {"message": "Duplicate detected. Proceed?", "requires_confirmation": True, "existing_id": existing.id}}
    return {"proceed": True}

def check_limits_and_cookies(db: Session, provider_id: int):
    # Check provider limits
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    credential = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    
    limits = credential.custom_limits if credential and credential.custom_limits else (provider.automatic_limits if provider else {})
    if limits and isinstance(limits, dict):
        max_concurrent = limits.get("concurrent_downloads")
        if max_concurrent:
            current_downloads = db.query(DownloadQueue).filter(DownloadQueue.status == 'running').count()
            if current_downloads >= int(max_concurrent):
                return False, "Concurrent download limit reached"
                
    # Check session cookies
    active_cookie = db.query(SessionCookie).filter(
        SessionCookie.provider_id == provider_id,
        SessionCookie.status == 'active'
    ).first()
    
    if active_cookie:
        if active_cookie.download_limit and active_cookie.downloads_used >= active_cookie.download_limit:
            active_cookie.status = 'limit_reached'
            db.commit()
            return False, "Session cookie download limit reached"
        if active_cookie.expires_at and datetime.utcnow() > active_cookie.expires_at:
            active_cookie.status = 'expired'
            db.commit()
            return False, "Session cookie expired"
            
    return True, active_cookie

@router.post("/start")
async def start_download(req: DownloadRequest, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        # Fallback for testing
        provider_name = "Example"
    else:
        provider_name = provider.name

    # 1. Fetch Preferences
    prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == req.provider_id).first()
    
    # 2. Extract Title for Naming & Duplicate Check
    meta = req.metadata or {}
    title = meta.get("title", "Unknown_Title")
    
    # 2.5 Evaluate Rules
    action = evaluate_rules(db, req.provider_id, meta)
    if action == "skip":
        return {"message": "Skipped due to custom download rule"}
    
    # 3. Duplicate Checking and Quality Upgrade
    dupe_check = evaluate_duplicate_quality(db, prefs, title, meta)
    if not dupe_check.get("proceed"):
        return dupe_check.get("response")
    
    # 3.5 Check Limits
    can_download, limit_result = check_limits_and_cookies(db, req.provider_id)
    if not can_download:
        action = "queue" # Force queue if limits reached
        
    # 4. Create Entries
    media = MediaEntry(
        provider_id=req.provider_id,
        title=title,
        performers=meta.get("performers", []),
        tags=meta.get("tags", []),
        media_metadata=meta
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    queue = DownloadQueue(
        media_entry_id=media.id,
        url=req.url,
        status="pending" if action != "queue" else "queued",
        progress_percentage=0.0
    )
    db.add(queue)
    db.commit()
    db.refresh(queue)
    
    # 5. Start Background Task (if not strictly just queued to wait)
    if action != "queue":
        if isinstance(limit_result, SessionCookie):
            limit_result.downloads_used += 1
            db.commit()
            
        prefs_dict = {
            "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
            "append_metadata": prefs.append_metadata if prefs else False,
            "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None
        }
        
        real_download_task.delay(queue.id, prefs_dict, meta)
        return {"message": "Download started", "task_id": queue.id, "media_id": media.id}
    
    return {"message": f"Download queued ({limit_result if not can_download else 'rule criteria'})", "task_id": queue.id, "media_id": media.id}

@router.get("/")
def get_download_queue(
    provider_id: Optional[int] = None,
    status: Optional[str] = None,
    url_contains: Optional[str] = None,
    title_contains: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Advanced filtering for the download list"""
    query = db.query(DownloadQueue).join(MediaEntry, DownloadQueue.media_entry_id == MediaEntry.id)
    
    if provider_id:
        query = query.filter(MediaEntry.provider_id == provider_id)
    if status:
        query = query.filter(DownloadQueue.status == status)
    if url_contains:
        query = query.filter(DownloadQueue.url.ilike(f"%{url_contains}%"))
    if title_contains:
        query = query.filter(MediaEntry.title.ilike(f"%{title_contains}%"))
        
    return query.all()

class MassRipRequest(BaseModel):
    provider_id: int
    url: str

@router.post("/mass_rip")
async def mass_rip(req: MassRipRequest, db: Session = Depends(get_db)):
    """
    Parses a channel/performer page, evaluates rules, and queues videos.
    (Mocked URL extraction for now)
    """
    # 1. Fetch provider
    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    # Extract URLs and metadata using yt-dlp's flat extraction
    ydl_opts = {'extract_flat': True, 'quiet': True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            
        extracted_videos = []
        if 'entries' in info:
            for entry in info['entries']:
                extracted_videos.append({
                    "url": entry.get('url') or entry.get('webpage_url'),
                    "metadata": {
                        "title": entry.get('title', 'Unknown')
                    }
                })
        else:
            extracted_videos.append({
                "url": info.get('url') or info.get('webpage_url') or req.url,
                "metadata": {
                    "title": info.get('title', 'Unknown')
                }
            })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract URLs: {str(e)}")
    
    prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == req.provider_id).first()
    queued_count = 0
    skipped_count = 0
    
    for video in extracted_videos:
        if not video["url"]:
            continue
        meta = video["metadata"]
        
        # 1.5 Duplicate Checking
        dupe_check = evaluate_duplicate_quality(db, prefs, meta.get("title", "Unknown"), meta)
        if not dupe_check.get("proceed"):
            skipped_count += 1
            continue
        
        # 2. Evaluate Rules
        action = evaluate_rules(db, req.provider_id, meta)
        if action == "skip":
            skipped_count += 1
            continue
            
        # 3. Add to Database
        media = MediaEntry(
            provider_id=req.provider_id,
            title=meta.get("title", "Unknown"),
            performers=meta.get("performers", []),
            tags=meta.get("tags", []),
            media_metadata=meta
        )
        db.add(media)
        db.commit()
        db.refresh(media)

        queue = DownloadQueue(
            media_entry_id=media.id,
            url=video["url"],
            status="pending" if action != "queue" else "queued",
            progress_percentage=0.0
        )
        db.add(queue)
        db.commit()
        db.refresh(queue)
        
        # 4. Fire Celery Task
        if action != "queue":
            prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == req.provider_id).first()
            prefs_dict = {
                "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
                "append_metadata": prefs.append_metadata if prefs else False,
                "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None
            }
            # Note: Quality Upgrade is handled during start_download usually, but we assume it's queued here.
            real_download_task.delay(queue.id, prefs_dict, meta)
            
        queued_count += 1
        
    return {
        "message": f"Mass rip completed. Queued: {queued_count}, Skipped: {skipped_count}",
        "queued": queued_count,
        "skipped": skipped_count
    }
