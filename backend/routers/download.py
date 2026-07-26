from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, contains_eager
from database import get_db
from db_utils import get_db_session
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

from dependencies import verify_api_key, require_permission

router = APIRouter(
    prefix="/download", tags=["download"], dependencies=[Depends(verify_api_key)]
)


class DownloadRequest(BaseModel):
    provider_id: int
    url: HttpUrl
    metadata: Optional[Dict[str, Any]] = None
    force_duplicate: bool = False


class ExtractStreamRequest(BaseModel):
    url: HttpUrl


class SaveStreamRequest(BaseModel):
    title: str
    url: HttpUrl


class AnalyzeUrlRequest(BaseModel):
    url: HttpUrl
    provider_id: Optional[int] = None


from utils import validate_url_ssrf


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
                    # PERFORMANCE: Use Hash Set for O(1) constant time lookups instead of O(N) list scans
                    list_items = {i.lower() for i in (custom_list.items or [])}
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
            db.query(LibraryEntry.id, LibraryEntry.resolution)
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

        # Time-span limits checking
        from datetime import datetime, timedelta
        from models import MediaEntry

        def count_downloads(hours: float) -> int:
            since = datetime.now() - timedelta(hours=hours)
            return (
                db.query(DownloadQueue)
                .join(MediaEntry, DownloadQueue.media_entry_id == MediaEntry.id)
                .filter(MediaEntry.provider_id == provider_id)
                .filter(DownloadQueue.created_at >= since)
                .count()
            )

        # Check hourly
        hourly_limit = limits.get("hourly_downloads") or limits.get("limit_hourly")
        if hourly_limit and count_downloads(1) >= int(hourly_limit):
            return False, "Hourly download limit reached"

        # Check daily
        daily_limit = limits.get("daily_downloads") or limits.get("limit_daily")
        if daily_limit and count_downloads(24) >= int(daily_limit):
            return False, "Daily download limit reached"

        # Check weekly
        weekly_limit = limits.get("weekly_downloads") or limits.get("limit_weekly")
        if weekly_limit and count_downloads(168) >= int(weekly_limit):
            return False, "Weekly download limit reached"

        # Check monthly
        monthly_limit = limits.get("monthly_downloads") or limits.get("limit_monthly")
        if monthly_limit and count_downloads(720) >= int(monthly_limit):
            return False, "Monthly download limit reached"

        # Check generic periodic limits
        # periodic_limits format: [{"hours": 12, "limit": 5}, {"hours": 48, "limit": 20}]
        periodic_limits = limits.get("periodic_limits")
        if periodic_limits and isinstance(periodic_limits, list):
            for pl in periodic_limits:
                if isinstance(pl, dict):
                    hours = pl.get("hours") or pl.get("period_hours")
                    limit = pl.get("limit") or pl.get("max_downloads")
                    if hours is not None and limit is not None:
                        if count_downloads(float(hours)) >= int(limit):
                            return False, f"Periodic limit reached ({limit} downloads per {hours} hours)"

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
def start_download(req: DownloadRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    from db_utils import check_feature_permission
    check_feature_permission(db, "ripping", current_user)

    # SECURITY: Prevent SSRF via the download engine
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=404, detail=f"Provider with ID {req.provider_id} not found."
        )

    # 0. Enforce Daily Rip Quota
    if hasattr(current_user, "permissions") and current_user.permissions:
        quotas = current_user.permissions.get("quotas", {})
        daily_rip_quota = quotas.get("dailyRips", 0)

        if daily_rip_quota > 0:
            from sqlalchemy import func
            today = datetime.now(timezone.utc).date()
            rips_today = db.query(DownloadQueue).filter(
                DownloadQueue.user_id == str(current_user.id),
                func.date(DownloadQueue.created_at) == today
            ).count()
            
            if rips_today >= daily_rip_quota:
                raise HTTPException(
                    status_code=403,
                    detail=f"Quota Exceeded: The system is limited to {daily_rip_quota} downloads per day."
                )

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
        db.query(DownloadQueue.id, DownloadQueue.media_entry_id)
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
        extraction_method="pending_analysis",
        user_id=str(current_user.id)
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
        cookie_obj = (
            db.query(SessionCookie)
            .filter(
                SessionCookie.provider_id == req.provider_id,
                SessionCookie.status == "active",
            )
            .first()
        )
        cookie_text = cookie_obj.cookie_text if cookie_obj else None

        prefs_dict = {
            "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
            "append_metadata": prefs.append_metadata if prefs else False,
            "custom_base_path": getattr(prefs, "custom_base_path", None)
            if prefs
            else None,
            "proxy_url": getattr(prefs, "proxy_url", None) if prefs else None,
            "download_subtitles": getattr(prefs, "download_subtitles", True)
            if prefs
            else True,
            "download_thumbnails": getattr(prefs, "download_thumbnails", True)
            if prefs
            else True,
            "concurrent_fragments": getattr(prefs, "concurrent_fragments", 5)
            if prefs
            else 5,
            "min_sleep_interval": float(getattr(prefs, "min_sleep_interval", 2.0))
            if prefs
            else 2.0,
            "max_sleep_interval": float(getattr(prefs, "max_sleep_interval", 5.0))
            if prefs
            else 5.0,
            "cookie_text": cookie_text,
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


@router.get("")
@router.get("/")
def get_download_queue(
    provider_id: Optional[int] = None,
    status: Optional[str] = None,
    url_contains: Optional[str] = None,
    title_contains: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("ripping", "view"))
):
    """Advanced filtering for the download list"""
    try:
        query = (
            db.query(DownloadQueue)
            .outerjoin(DownloadQueue.media_entry)
            .options(
                joinedload(DownloadQueue.media_entry).defer(MediaEntry.media_metadata),
                joinedload(DownloadQueue.media_entry).defer(MediaEntry.performers),
                joinedload(DownloadQueue.media_entry).defer(MediaEntry.tags),
            )
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
    except Exception:
        return []


@router.get("/stream")
def stream_download_queue(request: Request, current_user = Depends(require_permission("ripping", "view"))):
    """Server-Sent Events endpoint for real-time download progress updates."""

    def fetch_active_tasks():
        with get_db_session() as db:
            # Only push active tasks to the client to save bandwidth and memory
            tasks = (
                db.query(DownloadQueue)
                .options(
                    joinedload(DownloadQueue.media_entry).defer(
                        MediaEntry.media_metadata
                    ),
                    joinedload(DownloadQueue.media_entry).defer(
                        MediaEntry.performers
                    ),
                    joinedload(DownloadQueue.media_entry).defer(MediaEntry.tags),
                )
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
                        "extraction_method": t.extraction_method,
                        "media_entry": {
                            "id": media.id,
                            "title": media.title,
                            "provider_id": media.provider_id,
                        }
                        if media
                        else None,
                    }
                )
            return data

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                    
                # Offload the blocking database query to a background thread
                data = await asyncio.to_thread(fetch_active_tasks)
                yield f"data: {json.dumps(data)}\n\n"
                
                await asyncio.sleep(2.0)
        except asyncio.CancelledError:
            # Handle abrupt disconnections cleanly without throwing traceback errors
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class MassRipRequest(BaseModel):
    provider_id: int
    url: str
    action: Optional[str] = "metadata_and_download"
    criteria: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None


@router.post("/mass_rip")
def mass_rip(req: MassRipRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    """
    Asynchronously parses a channel/performer page, evaluates rules, and queues videos.
    """
    from db_utils import check_feature_permission
    check_feature_permission(db, "ripping", current_user)

    # SECURITY: Prevent SSRF
    validate_url_ssrf(req.url)

    user_id_to_use = None
    if isinstance(current_user, dict):
        user_id_to_use = req.user_id or "master_key"
    else:
        user_id_to_use = str(current_user.id)

    # 0. Enforce Daily Rip Quota
    # If triggered by master key, check the quota for the specified user_id if provided
    quota_user = None
    if user_id_to_use and user_id_to_use != "master_key":
        from models import User
        quota_user = db.query(User).filter(User.id == int(user_id_to_use)).first()
    elif not isinstance(current_user, dict):
        quota_user = current_user

    if quota_user and hasattr(quota_user, "permissions") and quota_user.permissions:
        quotas = quota_user.permissions.get("quotas", {})
        daily_rip_quota = quotas.get("dailyRips", 0)

        if daily_rip_quota > 0:
            from sqlalchemy import func
            from models import MassRipSession
            today = datetime.now(timezone.utc).date()
            rips_today = db.query(MassRipSession).filter(
                MassRipSession.user_id == str(quota_user.id),
                func.date(MassRipSession.created_at) == today
            ).count()
            
            if rips_today >= daily_rip_quota:
                raise HTTPException(
                    status_code=403,
                    detail=f"Quota Exceeded: The user '{quota_user.username}' is limited to {daily_rip_quota} mass rips per day."
                )

    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    from models import MassRipSession
    session = MassRipSession(
        provider_id=req.provider_id,
        url=req.url,
        criteria=req.criteria or {},
        status="pending",
        user_id=user_id_to_use
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Fire Celery task
    from tasks.download_tasks import mass_rip_task
    mass_rip_task.delay(session.id)

    return session


@router.get("/mass_rip/sessions")
def get_mass_rip_sessions(db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "view"))):
    from models import MassRipSession
    return db.query(MassRipSession).order_by(MassRipSession.created_at.desc()).all()


@router.get("/mass_rip/sessions/stream")
async def stream_mass_rip_sessions(
    request: Request,
    current_user = Depends(require_permission("ripping", "view")),
):
    """Server-Sent Events endpoint for real-time mass rip session updates."""

    def fetch_sessions():
        with get_db_session() as db:
            from models import MassRipSession
            sessions = db.query(MassRipSession).order_by(MassRipSession.created_at.desc()).all()
            return [
                {
                    "id": s.id,
                    "provider_id": s.provider_id,
                    "url": s.url,
                    "status": s.status,
                    "total_videos": s.total_videos,
                    "processed_videos": s.processed_videos,
                    "queued_videos": s.queued_videos,
                    "skipped_videos": s.skipped_videos,
                    "created_at": str(s.created_at) if s.created_at else "",
                    "updated_at": str(s.updated_at) if s.updated_at else "",
                }
                for s in sessions
            ]

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await asyncio.to_thread(fetch_sessions)
                yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(2.0)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/mass_rip/sessions/{session_id}")
def get_mass_rip_session(session_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "view"))):
    from models import MassRipSession
    session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/mass_rip/sessions/{session_id}/pause")
def pause_mass_rip(session_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    from models import MassRipSession
    session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "paused"
    db.commit()
    return session


@router.post("/mass_rip/sessions/{session_id}/resume")
def resume_mass_rip(session_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    from models import MassRipSession
    session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "running"
    db.commit()
    return session


@router.post("/mass_rip/sessions/{session_id}/stop")
def stop_mass_rip(session_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    from models import MassRipSession
    session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "stopped"
    db.commit()
    return session


@router.delete("/mass_rip/sessions/{session_id}")
def delete_mass_rip_session(session_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    from models import MassRipSession
    session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


@router.post("/extract-stream")
def extract_stream_url(req: ExtractStreamRequest, current_user = Depends(require_permission("ripping", "edit"))):
    """Uses yt-dlp to dynamically resolve a page URL to its raw live video stream URL."""
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    ydl_opts = {"quiet": True, "no_warnings": True, "format": "best"}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url_str, download=False)

            if info and "entries" in info and len(info["entries"]) > 0:
                first_entry = info["entries"][0]
                stream_url = first_entry.get("url")
                title = first_entry.get("title", "Live Stream")
            else:
                stream_url = info.get("url")
                title = info.get("title", "Live Stream")

            if not stream_url:
                raise HTTPException(
                    status_code=400,
                    detail="Could not detect a stream URL. The streamer might be offline.",
                )

            return {"stream_url": stream_url, "title": title}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to extract stream: {str(e)}"
        )


@router.post("/save-stream")
def save_live_stream(req: SaveStreamRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    """Saves a resolved live stream to the database."""
    from models import LiveStream

    validate_url_ssrf(str(req.url))

    base_name = req.title
    name = base_name
    counter = 1

    # Ensure unique name constraint is satisfied
    while db.query(LiveStream).filter(LiveStream.name == name).first():
        name = f"{base_name} ({counter})"
        counter += 1

    stream = LiveStream(name=name, url=str(req.url), status="idle")
    db.add(stream)
    db.commit()
    return {"message": "Live stream saved successfully", "id": stream.id}


@router.post("/analyze-url")
def analyze_url(req: AnalyzeUrlRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("ripping", "edit"))):
    """Analyzes a URL to detect the best scraping/downloading method."""
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    methods = []
    extractor = None

    # 1. Test yt-dlp compatibility
    ydl_opts = {"extract_flat": True, "quiet": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url_str, download=False)
            if info:
                extractor = info.get("extractor") or info.get("extractor_key")
                methods.append(f"yt-dlp ({extractor})")
    except yt_dlp.utils.DownloadError as e:
        err_msg = str(e).lower()
        if (
            "cookie" in err_msg
            or "login" in err_msg
            or "password" in err_msg
            or "unauthorized" in err_msg
        ):
            methods.append("authentication_required (cookies)")

    # 2. Test direct HTTP protocols
    try:
        resp = requests.head(url_str, timeout=5, allow_redirects=True)
        content_type = resp.headers.get("Content-Type", "").lower()
        if "video" in content_type or "mpegurl" in content_type:
            methods.append("direct_media_link")
        elif "json" in content_type:
            methods.append("json_api")
        elif "html" in content_type:
            methods.append("html_scrape")
    except Exception:
        pass

    return {"url": url_str, "extractor": extractor, "detected_methods": methods}
