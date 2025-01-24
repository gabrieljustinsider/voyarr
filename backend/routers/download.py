from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, contains_eager
from database import get_db, SessionLocal
from models import (
    DownloadQueue,
    MediaEntry,
    LibraryEntry,
    DownloadPreference,
    Provider,
    DownloadRule,
    CustomList,
    SessionCookie,
    Credential,
)
from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import yt_dlp
from tasks.download_tasks import real_download_task
import json
import asyncio
import requests
import re
import urllib.parse

from dependencies import verify_api_key

router = APIRouter(
    prefix="/download", tags=["download"], dependencies=[Depends(verify_api_key)]
)


class DownloadRequest(BaseModel):
    provider_id: int
    url: HttpUrl
    metadata: Optional[Dict[str, Any]] = None
    force_duplicate: bool = False


def validate_url_ssrf(url_str: str):
    if not url_str.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    try:
        parsed = urllib.parse.urlparse(url_str)
        hostname = parsed.hostname.lower() if parsed.hostname else ""

        try:
            import ipaddress
            import socket

            def is_disallowed_ip(ip_str_or_obj):
                try:
                    ip_obj = ipaddress.ip_address(ip_str_or_obj) if isinstance(ip_str_or_obj, str) else ip_str_or_obj
                    
                    # Unwrap IPv4-mapped IPv6 addresses to correctly evaluate their underlying IPv4 properties
                    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
                        ip_obj = ip_obj.ipv4_mapped
                        
                    return (
                        ip_obj.is_loopback
                        or ip_obj.is_private
                        or ip_obj.is_link_local
                        or ip_obj.is_multicast
                        or ip_obj.is_unspecified
                        or ip_obj.is_reserved
                    )
                except ValueError:
                    return False

            try:
                ip_obj = ipaddress.ip_address(hostname.strip("[]"))
                if is_disallowed_ip(ip_obj):
                    raise HTTPException(status_code=400, detail="Disallowed internal IP")
            except ValueError:
                pass
                
            # Resolve hostname to catch custom domains pointing to internal IPs
            try:
                addr_info = socket.getaddrinfo(hostname, None)
                for addr in addr_info:
                    ip_str = addr[4][0]
                    if is_disallowed_ip(ip_str):
                        raise HTTPException(status_code=400, detail="Disallowed internal IP (resolved via DNS)")
            except socket.gaierror:
                pass # Unresolvable hostnames will fail naturally downstream

            if hostname.startswith("0x"):
                ip_int = int(hostname, 16)
            elif hostname.startswith("0") and hostname.isdigit():
                ip_int = int(hostname, 8)
            elif hostname.isdigit():
                ip_int = int(hostname)
            else:
                ip_int = None
            if ip_int is not None and is_disallowed_ip(ipaddress.ip_address(ip_int)):
                raise HTTPException(
                    status_code=400, detail="Disallowed internal numeric IP"
                )
        except ValueError:
            pass

        if hostname in [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "169.254.169.254",
            "::1",
            "[::1]",
        ] or hostname.endswith((".internal", ".nip.io", ".xip.io", ".sslip.io")):
            raise HTTPException(status_code=400, detail="Disallowed internal hostname")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")


def evaluate_rules(
    db: Session,
    metadata: dict,
    rules: list[DownloadRule],
    custom_lists: Dict[int, CustomList],
):
    for rule in rules:
        criteria = rule.criteria or {}
        match = True
        for key, value in criteria.items():
            if key == "resolution" and metadata.get("resolution") != value:
                match = False
            elif key == "performers":
                performers = metadata.get("performers") or []
                if isinstance(value, dict) and "contains" in value:
                    if not any(
                        value["contains"].lower() in p.lower() for p in performers
                    ):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in [p.lower() for p in performers]:
                        match = False
            elif key == "categories" or key == "tags":
                tags_cats = (metadata.get("tags") or []) + (
                    metadata.get("categories") or []
                )
                if isinstance(value, dict) and "contains" in value:
                    if not any(
                        value["contains"].lower() in t.lower() for t in tags_cats
                    ):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in [t.lower() for t in tags_cats]:
                        match = False
            elif key == "series":
                series = metadata.get("series") or ""
                if isinstance(value, dict) and "contains" in value:
                    if value["contains"].lower() not in series.lower():
                        match = False
                elif isinstance(value, str):
                    if value.lower() != series.lower():
                        match = False
            elif key == "sub_site":
                sub_site = metadata.get("sub_site") or ""
                if value.lower() != sub_site.lower():
                    match = False
            elif key == "custom_terms":
                title = metadata.get("title")
                desc = metadata.get("description")
                title_str = (
                    " ".join(title) if isinstance(title, list) else str(title or "")
                )
                desc_str = " ".join(desc) if isinstance(desc, list) else str(desc or "")
                search_text = (title_str + " " + desc_str).lower()
                if isinstance(value, list):
                    if not any(term.lower() in search_text for term in value):
                        match = False
                elif isinstance(value, str):
                    if value.lower() not in search_text:
                        match = False
            elif key == "in_list":
                list_id = value
                custom_list = custom_lists.get(list_id)
                if custom_list:
                    list_items = [i.lower() for i in (custom_list.items or [])]
                    item_type = custom_list.item_type

                    if item_type == "performers":
                        meta_items = [
                            p.lower() for p in (metadata.get("performers") or [])
                        ]
                    elif item_type == "tags" or item_type == "categories":
                        meta_items = [
                            t.lower()
                            for t in (
                                (metadata.get("tags") or [])
                                + (metadata.get("categories") or [])
                            )
                        ]
                    elif item_type == "series":
                        meta_items = [(metadata.get("series") or "").lower()]
                    else:
                        meta_items = [
                            p.lower() for p in (metadata.get("performers") or [])
                        ] + [
                            t.lower()
                            for t in (
                                (metadata.get("tags") or [])
                                + (metadata.get("categories") or [])
                            )
                        ]

                    if not any(item in list_items for item in meta_items):
                        match = False
                else:
                    match = False

        if match and criteria:  # only trigger if there were criteria and they matched
            return rule.action

    return "download"


def evaluate_duplicate_quality(
    db: Session, prefs: DownloadPreference, title: str, meta: dict
):
    if prefs and prefs.duplicate_handling != "overwrite":
        escaped_title = (
            title.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        existing = (
            db.query(LibraryEntry)
            .filter(LibraryEntry.title.ilike(f"%{escaped_title}%", escape="\\"))
            .first()
        )
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
                    return {
                        "proceed": False,
                        "response": {
                            "message": "Skipped due to duplicate",
                            "duplicate_id": existing.id,
                        },
                    }
                elif prefs.duplicate_handling == "ask":
                    return {
                        "proceed": False,
                        "response": {
                            "message": "Duplicate detected. Proceed?",
                            "requires_confirmation": True,
                            "existing_id": existing.id,
                        },
                    }
    return {"proceed": True}


def check_limits_and_cookies(db: Session, provider_id: int):
    # Check provider limits
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    credential = (
        db.query(Credential).filter(Credential.provider_id == provider_id).first()
    )

    limits = (
        credential.custom_limits
        if credential and credential.custom_limits
        else (provider.automatic_limits if provider else {})
    )
    if limits and isinstance(limits, dict):
        max_concurrent = limits.get("concurrent_downloads")
        if max_concurrent:
            current_downloads = (
                db.query(DownloadQueue)
                .filter(DownloadQueue.status == "running")
                .count()
            )
            if current_downloads >= int(max_concurrent):
                return False, "Concurrent download limit reached"

    # Check session cookies
    active_cookie = (
        db.query(SessionCookie)
        .filter(
            SessionCookie.provider_id == provider_id, SessionCookie.status == "active"
        )
        .first()
    )

    if active_cookie:
        if (
            active_cookie.download_limit
            and active_cookie.downloads_used >= active_cookie.download_limit
        ):
            active_cookie.status = "limit_reached"
            return False, "Session cookie download limit reached"
        if (
            active_cookie.expires_at
            and datetime.now(timezone.utc).replace(tzinfo=None)
            > active_cookie.expires_at
        ):
            active_cookie.status = "expired"
            return False, "Session cookie expired"

    return True, active_cookie


@router.post("/start")
def start_download(req: DownloadRequest, db: Session = Depends(get_db)):
    # SECURITY: Prevent SSRF via the download engine
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        # Fallback for testing
        pass
    else:
        pass

    # 1. Fetch Preferences
    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == req.provider_id)
        .first()
    )

    # 2. Extract Title for Naming & Duplicate Check
    meta = req.metadata or {}
    title = meta.get("title", "Unknown_Title")
    title_raw = meta.get("title")
    title = (
        title_raw[0]
        if isinstance(title_raw, list) and title_raw
        else str(title_raw or "Unknown_Title")
    )

    # 2.5 Evaluate Rules
    rules = (
        db.query(DownloadRule)
        .filter(
            DownloadRule.is_active,
            (DownloadRule.scope == "global")
            | (DownloadRule.scope == "session")
            | (DownloadRule.scope == f"provider:{req.provider_id}"),
        )
        .all()
    )
    list_ids = [
        rule.criteria["in_list"]
        for rule in rules
        if rule.criteria and "in_list" in rule.criteria
    ]
    custom_lists_query = (
        db.query(CustomList).filter(CustomList.id.in_(list_ids)).all()
        if list_ids
        else []
    )
    custom_lists_map = {cl.id: cl for cl in custom_lists_query}

    action = evaluate_rules(db, meta, rules, custom_lists_map)
    if action == "skip":
        return {"message": "Skipped due to custom download rule"}

    # 3. Duplicate Checking and Quality Upgrade
    if not req.force_duplicate:
        dupe_check = evaluate_duplicate_quality(db, prefs, title, meta)
        if not dupe_check.get("proceed"):
            return dupe_check.get("response")

    # 3.2 Check Active Download Queue for Duplicates
    existing_queue = (
        db.query(DownloadQueue)
        .filter(
            DownloadQueue.url == str(req.url),
            DownloadQueue.status.in_(["pending", "running", "queued"]),
        )
        .first()
    )
    if existing_queue:
        return {
            "message": "Video is already in the download queue.",
            "task_id": existing_queue.id,
            "media_id": existing_queue.media_entry_id,
        }

    # 3.5 Check Limits
    can_download, limit_result = check_limits_and_cookies(db, req.provider_id)
    if not can_download:
        action = "queue"  # Force queue if limits reached

    # 4. Create and stage database entries
    media = MediaEntry(
        provider_id=req.provider_id,
        title=title,
        performers=meta.get("performers", []),
        tags=meta.get("tags", []),
        media_metadata=meta,
    )
    db.add(media)

    queue = DownloadQueue(
        url=str(req.url),
        status="pending" if action != "queue" else "queued",
        progress_percentage=0.0,
    )
    queue.media_entry = media
    db.add(queue)

    if action != "queue":
        if isinstance(limit_result, SessionCookie):
            limit_result.downloads_used += 1

    # Commit all changes in a single, atomic transaction
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(media)
    db.refresh(queue)

    # 5. Start Background Task (if not strictly just queued to wait)
    if action != "queue":
        prefs_dict = {
            "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
            "append_metadata": prefs.append_metadata if prefs else False,
            "custom_base_path": getattr(prefs, "custom_base_path", None)
            if prefs
            else None,
        }

        real_download_task.delay(queue.id, prefs_dict, meta)
        return {
            "message": "Download started",
            "task_id": queue.id,
            "media_id": media.id,
        }

    return {
        "message": f"Download queued ({limit_result if not can_download else 'rule criteria'})",
        "task_id": queue.id,
        "media_id": media.id,
    }


@router.get("/")
def get_download_queue(
    provider_id: Optional[int] = None,
    status: Optional[str] = None,
    url_contains: Optional[str] = None,
    title_contains: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Advanced filtering for the download list"""
    # Use contains_eager to prevent N+1 queries when joining the media_entry relationship
    query = (
        db.query(DownloadQueue)
        .join(DownloadQueue.media_entry)
        .options(contains_eager(DownloadQueue.media_entry))
    )

    if provider_id:
        query = query.filter(MediaEntry.provider_id == provider_id)
    if status:
        query = query.filter(DownloadQueue.status == status)
    if url_contains:
        query = query.filter(DownloadQueue.url.ilike(f"%{url_contains}%"))
    if title_contains:
        query = query.filter(MediaEntry.title.ilike(f"%{title_contains}%"))

    return query.all()


@router.get("/stream")
def stream_download_queue(request: Request):
    """Server-Sent Events endpoint for real-time download progress updates."""

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            db = SessionLocal()
            try:
                # Only push active tasks to the client to save bandwidth and memory
                tasks = (
                    db.query(DownloadQueue)
                    .options(joinedload(DownloadQueue.media_entry))
                    .filter(DownloadQueue.status.in_(["pending", "running", "queued"]))
                    .all()
                )

                data = []
                for t in tasks:
                    media = t.media_entry
                    data.append(
                        {
                            "id": t.id,
                            "url": t.url,
                            "status": t.status,
                            "progress_percentage": float(t.progress_percentage)
                            if t.progress_percentage is not None
                            else 0.0,
                            "media_entry": {
                                "id": media.id,
                                "title": media.title,
                                "provider_id": media.provider_id,
                            }
                            if media
                            else None,
                        }
                    )
                yield f"data: {json.dumps(data)}\n\n"
            finally:
                db.close()
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class MassRipRequest(BaseModel):
    provider_id: int
    url: HttpUrl
    action: Optional[str] = "metadata_and_download"


@router.post("/mass_rip")
def mass_rip(req: MassRipRequest, db: Session = Depends(get_db)):
    """
    Parses a channel/performer page, evaluates rules, and queues videos.
    (Mocked URL extraction for now)
    """
    # SECURITY: Prevent SSRF via the download engine
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    # 1. Fetch provider
    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Extract URLs and metadata using yt-dlp's flat extraction
    ydl_opts = {"extract_flat": True, "quiet": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url_str, download=False)

        extracted_videos = []
        if info and "entries" in info:
            for entry in info["entries"]:
                if not entry:
                    continue
                url = entry.get("url") or entry.get("webpage_url")
                if url:
                    extracted_videos.append(
                        {
                            "url": url,
                            "metadata": {"title": entry.get("title", "Unknown")},
                        }
                    )
        elif info:
            extracted_videos.append(
                {
                    "url": info.get("url") or info.get("webpage_url") or url_str,
                    "metadata": {"title": info.get("title", "Unknown")},
                }
            )

        # Hardened Fallback: If yt-dlp returns nothing, try a naive HTML scrape
        if not extracted_videos:
            resp = requests.get(url_str, timeout=15, allow_redirects=False)
            hrefs = re.findall(r'href=[\'"]?([^\'" >]+)', resp.text)
            for href in set(hrefs):
                if (
                    "/video/" in href.lower()
                    or "/watch/" in href.lower()
                    or ".mp4" in href.lower()
                ):
                    full_url = (
                        href
                        if href.startswith("http")
                        else url_str.rstrip("/") + "/" + href.lstrip("/")
                    )
                    extracted_videos.append(
                        {"url": full_url, "metadata": {"title": "Unknown"}}
                    )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract URLs: {str(e)}")

    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == req.provider_id)
        .first()
    )
    queued_count = 0
    skipped_count = 0
    tasks_to_fire = []

    # Prepare prefs_dict once to avoid re-querying in a loop
    prefs_dict = {
        "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
        "append_metadata": prefs.append_metadata if prefs else False,
        "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None,
    }

    rules = (
        db.query(DownloadRule)
        .filter(
            DownloadRule.is_active,
            (DownloadRule.scope == "global")
            | (DownloadRule.scope == "session")
            | (DownloadRule.scope == f"provider:{req.provider_id}"),
        )
        .all()
    )

    # Pre-fetch custom lists to avoid N+1 queries in evaluate_rules
    list_ids = [
        rule.criteria["in_list"]
        for rule in rules
        if rule.criteria and "in_list" in rule.criteria
    ]
    custom_lists_query = (
        db.query(CustomList).filter(CustomList.id.in_(list_ids)).all()
        if list_ids
        else []
    )
    custom_lists_map = {cl.id: cl for cl in custom_lists_query}

    for video in extracted_videos:
        if not video["url"]:
            continue
        meta = video["metadata"]

        title_raw = meta.get("title")
        title = (
            title_raw[0]
            if isinstance(title_raw, list) and title_raw
            else str(title_raw or "Unknown")
        )

        # 1.5 Duplicate Checking
        dupe_check = evaluate_duplicate_quality(db, prefs, title, meta)
        if not dupe_check.get("proceed"):
            skipped_count += 1
            continue

        # 2. Evaluate Rules
        action = evaluate_rules(db, meta, rules, custom_lists_map)
        if action == "skip":
            skipped_count += 1
            continue

        # 2.2 Check Active Download Queue for Duplicates
        existing_queue = (
            db.query(DownloadQueue)
            .filter(
                DownloadQueue.url == video["url"],
                DownloadQueue.status.in_(["pending", "running", "queued"]),
            )
            .first()
        )
        if existing_queue:
            skipped_count += 1
            continue

        # 2.5 Check Limits
        can_download, limit_result = check_limits_and_cookies(db, req.provider_id)
        if not can_download:
            action = "queue"

        # 3. Add to session, but don't commit yet
        media = MediaEntry(
            provider_id=req.provider_id,
            title=title,
            performers=meta.get("performers", []),
            tags=meta.get("tags", []),
            media_metadata=meta,
        )

        if req.action in ["metadata_and_download", "download_only"]:
            queue = DownloadQueue(
                url=video["url"],
                status="pending" if action != "queue" else "queued",
                progress_percentage=0.0,
            )
            queue.media_entry = media
            db.add(queue)
            db.flush()

            # 4. Defer Celery task until after commit
            if action != "queue":
                if isinstance(limit_result, SessionCookie):
                    limit_result.downloads_used += 1
                tasks_to_fire.append({"queue_id": queue.id, "meta": meta})

            queued_count += 1
        else:
            db.add(media)
            skipped_count += 1

    # Commit all new entries in a single transaction
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Now that the queue items have IDs, dispatch the Celery tasks
    for task_info in tasks_to_fire:
        real_download_task.delay(task_info["queue_id"], prefs_dict, task_info["meta"])

    return {
        "message": f"Mass rip completed. Queued: {queued_count}, Skipped: {skipped_count}",
        "queued": queued_count,
        "skipped": skipped_count,
    }
