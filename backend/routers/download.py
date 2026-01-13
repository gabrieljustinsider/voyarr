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
import re
import os
import tempfile

from dependencies import verify_api_key

router = APIRouter(
    prefix="/download", tags=["download"], dependencies=[Depends(verify_api_key)]
)


def check_ripping_permission(
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    from db_utils import check_feature_permission
    from models import User
    user = None
    if auth_info.get("type") == "jwt" and auth_info.get("user"):
        user = db.query(User).filter(User.username == auth_info.get("user")).first()
    check_feature_permission(db, "ripping", user)


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


@router.post("/start", dependencies=[Depends(check_ripping_permission)])
def start_download(req: DownloadRequest, db: Session = Depends(get_db)):
    # SECURITY: Prevent SSRF via the download engine
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=404, detail=f"Provider with ID {req.provider_id} not found."
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
        .options(
            contains_eager(DownloadQueue.media_entry).defer(MediaEntry.media_metadata),
            contains_eager(DownloadQueue.media_entry).defer(MediaEntry.performers),
            contains_eager(DownloadQueue.media_entry).defer(MediaEntry.tags),
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


@router.get("/stream")
def stream_download_queue(request: Request):
    """Server-Sent Events endpoint for real-time download progress updates."""

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
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
                yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class MassRipRequest(BaseModel):
    provider_id: int
    url: HttpUrl
    action: Optional[str] = "metadata_and_download"


@router.post("/mass_rip", dependencies=[Depends(check_ripping_permission)])
def mass_rip(req: MassRipRequest, db: Session = Depends(get_db)):
    """
    Parses a channel/performer page, evaluates rules, and queues videos.
    """
    # SECURITY: Prevent SSRF via the download engine
    url_str = str(req.url)
    validate_url_ssrf(url_str)

    # 1. Fetch provider
    provider = db.query(Provider).filter(Provider.id == req.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == req.provider_id)
        .first()
    )

    # Extract URLs and metadata using yt-dlp's flat extraction
    ydl_opts = {"extract_flat": True, "quiet": True}
    if prefs:
        if getattr(prefs, "proxy_url", None):
            ydl_opts["proxy"] = prefs.proxy_url
        if getattr(prefs, "sleep_requests", None):
            ydl_opts["sleep_requests"] = float(prefs.sleep_requests)

    cookie_obj = (
        db.query(SessionCookie)
        .filter(
            SessionCookie.provider_id == req.provider_id,
            SessionCookie.status == "active",
        )
        .first()
    )
    cookie_text = cookie_obj.cookie_text if cookie_obj else None

    cookie_file_path = None
    if cookie_text:
        fd, cookie_file_path = tempfile.mkstemp(suffix=".txt")
        with os.fdopen(fd, "w") as f:
            f.write(cookie_text)
        ydl_opts["cookiefile"] = cookie_file_path

    used_method = "yt-dlp"
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url_str, download=False)

        extracted_videos = []
        if info and "entries" in info:
            extractor = info.get("extractor", "generic")
            used_method = f"yt-dlp ({extractor})"
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
            extractor = info.get("extractor", "generic")
            used_method = f"yt-dlp ({extractor})"
            extracted_videos.append(
                {
                    "url": info.get("url") or info.get("webpage_url") or url_str,
                    "metadata": {"title": info.get("title", "Unknown")},
                }
            )

        # Hardened Fallback: If yt-dlp returns nothing, try a naive HTML scrape
        if not extracted_videos:
            used_method = "html_scrape"
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
    finally:
        if cookie_file_path and os.path.exists(cookie_file_path):
            os.remove(cookie_file_path)

    queued_count = 0
    skipped_count = 0
    tasks_to_fire = []

    # Prepare prefs_dict once to avoid re-querying in a loop
    prefs_dict = {
        "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
        "append_metadata": prefs.append_metadata if prefs else False,
        "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None,
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

        # SECURITY: Prevent SSRF via extracted URLs
        try:
            validate_url_ssrf(video["url"])
        except HTTPException:
            skipped_count += 1
            continue

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
            db.query(DownloadQueue.id)
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
                extraction_method=used_method,
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


@router.post("/extract-stream", dependencies=[Depends(check_ripping_permission)])
def extract_stream_url(req: ExtractStreamRequest):
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


@router.post("/save-stream", dependencies=[Depends(check_ripping_permission)])
def save_live_stream(req: SaveStreamRequest, db: Session = Depends(get_db)):
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


@router.post("/analyze-url", dependencies=[Depends(check_ripping_permission)])
def analyze_url(req: AnalyzeUrlRequest, db: Session = Depends(get_db)):
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
