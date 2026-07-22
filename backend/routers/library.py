from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, defer, selectinload
from database import get_db
from models import LibraryEntry, DownloadPreference, FileNamingHistory
from typing import Optional, List
from pydantic import BaseModel
import os
from services.reverse_regex import ReverseRegexMatcher
from tasks.ml_tasks import cluster_faces_task
from tasks.ai_tasks import auto_tag_video_task
from tasks.transcode_tasks import generate_hls_task
from tasks.scanner_tasks import process_missing_hashes_task

from dependencies import verify_api_key, require_permission
from utils import get_media_roots, validate_path, sanitize_tainted_path
from rate_limiter import rate_limit
from routers.deovr import verify_deovr_auth

router = APIRouter(prefix="/library", tags=["library"])


@router.post(
    "/scan", dependencies=[Depends(rate_limit(max_requests=3, window_seconds=60)), Depends(verify_api_key)]
)
def scan_library(
    provider_id: Optional[int] = None,
    directory: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("library", "edit"))
):
    """Scan a directory and reverse-engineer filenames into Library entries."""

    media_roots = get_media_roots()
    target_dirs = []

    if directory:
        # SECURITY: Prevent path traversal and arbitrary directory scanning
        target_dir = os.path.abspath(os.path.normpath(directory))
        is_valid_dir = False
        for root in media_roots:
            root_abs = os.path.abspath(os.path.normpath(root))
            if target_dir.startswith(root_abs + os.sep) or target_dir == root_abs:
                is_valid_dir = True
                break

        if not is_valid_dir:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Cannot scan directories outside of the configured media root.",
            )
        target_dirs.append(target_dir)
    else:
        target_dirs = media_roots

    pattern = None
    if provider_id is not None:
        prefs = (
            db.query(DownloadPreference)
            .filter(DownloadPreference.provider_id == provider_id)
            .first()
        )
        pattern = prefs.naming_pattern if prefs else "{title}_{performers}_{resolution}"

    matcher = ReverseRegexMatcher(db)
    import typing

    aggregated_result: typing.Dict[str, typing.Any] = {
        "added": 0,
        "matched": 0,
        "errors": [],
    }

    for d in target_dirs:
        abs_d = sanitize_tainted_path(d)
        if abs_d == "/":
            continue
        if not os.path.exists(abs_d):
            continue
        result = matcher.scan_directory(abs_d, provider_id, pattern)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        aggregated_result["added"] += result.get("added", 0)
        aggregated_result["matched"] += result.get("matched", 0)
        aggregated_result["errors"].extend(result.get("errors", []))

    return {"message": "Scan complete", "result": aggregated_result}

@router.get("", dependencies=[Depends(verify_api_key)])
def get_library_entries(
    provider_id: Optional[int] = None,
    resolution: Optional[str] = None,
    tag: Optional[str] = None,
    performer: Optional[str] = None,
    ohash: Optional[str] = None,
    adheres_to_naming_scheme: Optional[bool] = None,
    has_metadata_match: Optional[bool] = None,
    has_chapters: Optional[bool] = None,
    has_facial_clusters: Optional[bool] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("library", "view"))
):
    # PERFORMANCE: Eagerly fetch 1-to-Many chapters to prevent N+1 queries during Pydantic serialization
    query = db.query(LibraryEntry).options(defer(LibraryEntry.entry_metadata), selectinload(LibraryEntry.chapters))

    # Enforce restricted tags filtering server-side
    if hasattr(current_user, "permissions") and current_user.permissions:
        restrictions = current_user.permissions.get("restrictions", {})
        restricted_tags = restrictions.get("tags", [])
        if restricted_tags:
            # Optimize multi-tag exclusions using a single Postgres Array Overlap (&&) evaluation
            query = query.filter(~LibraryEntry.tags.overlap(restricted_tags))

    if provider_id is not None:
        query = query.filter(LibraryEntry.provider_id == provider_id)
    if resolution is not None:
        query = query.filter(LibraryEntry.resolution == resolution)
    if tag is not None:
        query = query.filter(LibraryEntry.tags.contains([tag]))
    if performer is not None:
        query = query.filter(LibraryEntry.performers.contains([performer]))
    if ohash is not None:
        query = query.filter(LibraryEntry.ohash == ohash)
    if adheres_to_naming_scheme is not None:
        query = query.filter(LibraryEntry.adheres_to_naming_scheme == adheres_to_naming_scheme)
    if has_metadata_match is not None:
        query = query.filter(LibraryEntry.has_metadata_match == has_metadata_match)
    if has_chapters is not None:
        query = query.filter(LibraryEntry.has_chapters == has_chapters)
    if has_facial_clusters is not None:
        query = query.filter(LibraryEntry.has_facial_clusters == has_facial_clusters)

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": items,
        "total": total,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
    }


@router.get("/{entry_id}/stream", dependencies=[Depends(verify_deovr_auth)])
def stream_video(
    entry_id: int,
    db: Session = Depends(get_db)
):
    from db_utils import check_feature_permission
    check_feature_permission(db, "streaming")

    file_path = (
        db.query(LibraryEntry.file_path).filter(LibraryEntry.id == entry_id).scalar()
    )
    if not file_path:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Map common video/audio extensions to correct MIME types
    MIME_MAP = {
        ".mp4": "video/mp4",
        ".m4v": "video/mp4",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".ogv": "video/ogg",
        ".avi": "video/x-msvideo",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".ts": "video/mp2t",
        ".m2ts": "video/mp2t",
        ".mts": "video/mp2t",
        ".mpeg": "video/mpeg",
        ".mpg": "video/mpeg",
        ".3gp": "video/3gpp",
        ".3g2": "video/3gpp2",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".opus": "audio/opus",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".weba": "audio/webm",
    }
    ext = os.path.splitext(file_path)[1].lower()
    media_type = MIME_MAP.get(ext, "application/octet-stream")

    return FileResponse(
        file_path,
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Disposition": "inline",
        }
    )


@router.get("/{entry_id}/funscript", dependencies=[Depends(verify_deovr_auth)])
def get_library_funscript(entry_id: int, db: Session = Depends(get_db)):
    file_path = db.query(LibraryEntry.file_path).filter(LibraryEntry.id == entry_id).scalar()
    if not file_path:
        raise HTTPException(status_code=404, detail="Media entry not found")

    base, _ = os.path.splitext(file_path)
    funscript_path = base + ".funscript"
    if not os.path.exists(funscript_path):
        raise HTTPException(status_code=404, detail="No funscript file found for this entry")

    return FileResponse(
        funscript_path,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=" + os.path.basename(funscript_path)}
    )


@router.post(
    "/rescan-hashes",
    dependencies=[Depends(rate_limit(max_requests=2, window_seconds=60)), Depends(verify_api_key)],
)
def rescan_hashes(db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    task = process_missing_hashes_task.delay()
    return {
        "message": "Hash rescan started in the background. This may take a while.",
        "task_id": task.id,
    }


@router.post("/{entry_id}/cluster-faces", dependencies=[Depends(verify_api_key)])
def trigger_facial_clustering(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    task = cluster_faces_task.delay(entry.id)
    return {"message": "Facial clustering task queued", "task_id": task.id}


@router.get("/{entry_id}/facial-clusters", dependencies=[Depends(verify_api_key)])
def get_facial_clusters(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "view"))):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    return (entry.entry_metadata or {}).get("facial_clusters", {})


@router.get("/{entry_id}/facial-clusters/{person_name}/thumbnail", dependencies=[Depends(verify_deovr_auth)])
def get_facial_cluster_thumbnail(
    entry_id: int, person_name: str, db: Session = Depends(get_db)
):
    file_path = (
        db.query(LibraryEntry.file_path).filter(LibraryEntry.id == entry_id).scalar()
    )
    if not file_path:
        raise HTTPException(status_code=404, detail="Library entry not found")

    faces_dir = os.path.abspath(os.path.normpath(os.path.join(os.path.dirname(file_path), f".faces_{entry_id}")))
    safe_person_name = os.path.basename(person_name)
    thumb_path = os.path.abspath(os.path.normpath(os.path.join(faces_dir, f"{safe_person_name}.jpg")))

    if not thumb_path.startswith(faces_dir + os.sep):
        raise HTTPException(status_code=403, detail="Forbidden: Path traversal detected.")

    if not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(thumb_path, media_type="image/jpeg")


class RenameClusterRequest(BaseModel):
    new_name: str


@router.post("/{entry_id}/facial-clusters/{person_name}/rename", dependencies=[Depends(verify_api_key)])
def rename_facial_cluster(
    entry_id: int,
    person_name: str,
    req: RenameClusterRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("library", "edit"))
):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry or not entry.file_path:
        raise HTTPException(status_code=404, detail="Library entry not found")

    meta = (entry.entry_metadata or {}).copy()
    clusters = meta.get("facial_clusters", {})

    if person_name not in clusters:
        raise HTTPException(status_code=404, detail=f"Cluster {person_name} not found")

    safe_new_name = os.path.basename(req.new_name)
    if not safe_new_name or req.new_name != safe_new_name:
        raise HTTPException(
            status_code=400, detail="Invalid new name: cannot contain path separators."
        )

    from sqlalchemy.orm.attributes import flag_modified

    # Update JSON metadata
    clusters[safe_new_name] = clusters.pop(person_name)
    meta["facial_clusters"] = clusters
    entry.entry_metadata = meta
    flag_modified(entry, "entry_metadata")

    # Also add the new performer name to the global performers list if not already there
    performers = entry.performers or []
    if safe_new_name not in performers:
        entry.performers = performers + [safe_new_name]

    db.commit()

    # Rename physical thumbnail
    safe_entry_path = validate_path(entry.file_path)
    faces_dir = os.path.join(os.path.dirname(safe_entry_path), f".faces_{entry.id}")
    safe_old_name = os.path.basename(person_name)
    old_thumb = os.path.join(faces_dir, f"{safe_old_name}.jpg")
    new_thumb = os.path.join(faces_dir, f"{safe_new_name}.jpg")

    # Inline sanitization for CodeQL path injection tracking
    abs_old = sanitize_tainted_path(validate_path(old_thumb))
    abs_new = sanitize_tainted_path(validate_path(new_thumb))
    if abs_old == "/" or abs_new == "/":
        raise HTTPException(status_code=403, detail="Access denied")

    if os.path.exists(abs_old):
        os.rename(abs_old, abs_new)

    return {"message": "Cluster renamed successfully", "new_name": safe_new_name}



@router.delete("/{entry_id}", dependencies=[Depends(verify_api_key)])
def delete_library_entry(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    # Clean up associated foreign key records to prevent IntegrityError
    try:
        from models import FileNamingHistory, DuplicateEntry, VideoChapter
        db.query(FileNamingHistory).filter(FileNamingHistory.library_entry_id == entry_id).delete(synchronize_session=False)
        db.query(VideoChapter).filter(VideoChapter.library_entry_id == entry_id).delete(synchronize_session=False)
        db.query(DuplicateEntry).filter(
            (DuplicateEntry.library_entry_id1 == entry_id) | (DuplicateEntry.library_entry_id2 == entry_id)
        ).delete(synchronize_session=False)
    except Exception as e:
        logger.warning(f"Error cleaning up child records for library entry {entry_id}: {e}")

    # Attempt to delete the physical media file safely
    if entry.file_path:
        try:
            safe_file_path = sanitize_tainted_path(entry.file_path)
            if safe_file_path != "/" and os.path.exists(safe_file_path):
                os.remove(safe_file_path)
        except Exception as e:
            logger.warning(f"Could not remove physical media file for entry {entry_id}: {e}")

    db.delete(entry)
    db.commit()
    return {"message": "Library entry and physical media deleted successfully"}


@router.post("/{entry_id}/hls/generate", dependencies=[Depends(verify_api_key)])
def trigger_hls_generation(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    exists = db.query(LibraryEntry.id).filter(LibraryEntry.id == entry_id).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Library entry not found")

    task = generate_hls_task.delay(entry_id)
    return {"message": "HLS generation task queued", "task_id": task.id}


@router.get("/{entry_id}/hls/{filename}", dependencies=[Depends(verify_deovr_auth)])
def serve_hls_file(entry_id: int, filename: str, db: Session = Depends(get_db)):
    from db_utils import check_feature_permission
    check_feature_permission(db, "streaming")

    file_path = (
        db.query(LibraryEntry.file_path).filter(LibraryEntry.id == entry_id).scalar()
    )
    if not file_path:
        raise HTTPException(status_code=404, detail="Library entry not found")

    safe_filename = os.path.basename(filename)
    if not safe_filename.endswith(".m3u8") and not safe_filename.endswith(".ts"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    safe_entry_path = validate_path(file_path)
    hls_dir = f"{safe_entry_path}.hls"
    target_hls = os.path.join(hls_dir, safe_filename)

    # Inline sanitization for CodeQL path injection tracking
    abs_file_path = sanitize_tainted_path(validate_path(target_hls))
    if abs_file_path == "/":
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(abs_file_path):
        raise HTTPException(
            status_code=404, detail="HLS file not found. Ensure generation is complete."
        )


    media_type = (
        "application/vnd.apple.mpegurl"
        if safe_filename.endswith(".m3u8")
        else "video/MP2T"
    )
    return FileResponse(abs_file_path, media_type=media_type)


class ManualBulkEditRequest(BaseModel):
    entry_ids: List[int]
    tags_to_add: List[str] = []
    tags_to_remove: List[str] = []
    performers_to_add: List[str] = []
    performers_to_remove: List[str] = []
    studio_id: Optional[int] = None
    resolution: Optional[str] = None


@router.post("/bulk-edit/manual", dependencies=[Depends(verify_api_key)])
def manual_bulk_edit(req: ManualBulkEditRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    """Instantly add or remove tags, performers, and update studio or resolution across multiple videos."""
    entries = (
        db.query(LibraryEntry)
        .options(defer(LibraryEntry.entry_metadata))
        .filter(LibraryEntry.id.in_(req.entry_ids))
        .all()
    )
    if not entries:
        raise HTTPException(
            status_code=404, detail="No entries found for the provided IDs."
        )

    add_tags = set(req.tags_to_add)
    rem_tags = set(req.tags_to_remove)
    add_perfs = set(req.performers_to_add)
    rem_perfs = set(req.performers_to_remove)

    for entry in entries:
        if add_tags or rem_tags:
            current_tags = set(entry.tags or [])
            current_tags.update(add_tags)
            current_tags.difference_update(rem_tags)
            entry.tags = list(current_tags)

        if add_perfs or rem_perfs:
            current_perfs = set(entry.performers or [])
            current_perfs.update(add_perfs)
            current_perfs.difference_update(rem_perfs)
            entry.performers = list(current_perfs)

        if req.resolution is not None:
            entry.resolution = req.resolution

        if req.studio_id is not None:
            entry.studio_id = req.studio_id

    db.commit()
    return {"message": f"Successfully updated {len(entries)} entries."}


class AIBulkTagRequest(BaseModel):
    entry_ids: List[int]


@router.post("/bulk-tag/ai", dependencies=[Depends(verify_api_key)])
def ai_bulk_tag(req: AIBulkTagRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    """Queue up multiple videos for automated AI tagging via the vision models."""
    entry_ids = (
        db.query(LibraryEntry.id).filter(LibraryEntry.id.in_(req.entry_ids)).all()
    )
    if not entry_ids:
        raise HTTPException(
            status_code=404, detail="No entries found for the provided IDs."
        )

    for (eid,) in entry_ids:
        auto_tag_video_task.delay(eid)

    return {
        "message": f"Successfully queued AI auto-tagging for {len(entry_ids)} entries."
    }


class RenameRequest(BaseModel):
    new_filename: str


@router.post("/{entry_id}/rename", dependencies=[Depends(verify_api_key)])
def rename_library_file(entry_id: int, req: RenameRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    """Physically rename a video file in the library and log the action in the naming history log."""
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    old_path = entry.file_path
    if not os.path.exists(old_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    old_dir = os.path.dirname(old_path)
    old_filename = os.path.basename(old_path)

    # Safe new filename checks
    safe_new_filename = os.path.basename(req.new_filename).strip()
    if not safe_new_filename:
        raise HTTPException(status_code=400, detail="Invalid new filename")

    new_path = validate_path(os.path.join(old_dir, safe_new_filename))
    old_path = validate_path(old_path)

    # Inline sanitization for CodeQL path injection tracking
    abs_old = sanitize_tainted_path(old_path)
    abs_new = sanitize_tainted_path(new_path)
    if abs_old == "/" or abs_new == "/":
        raise HTTPException(status_code=403, detail="Access denied")

    if os.path.exists(abs_new) and abs_new != abs_old:
        raise HTTPException(status_code=400, detail="Target filename already exists on disk")

    try:
        os.rename(abs_old, abs_new)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to physically rename file: {str(e)}")

    # Update database
    try:
        entry.file_path = new_path

        # Log naming history
        history = FileNamingHistory(
            library_entry_id=entry.id,
            old_path=old_path,
            new_path=new_path,
            old_filename=old_filename,
            new_filename=safe_new_filename,
            reason="manual_correction"
        )
        db.add(history)
        db.commit()
    except Exception as db_err:
        db.rollback()
        # Roll back physical rename to keep disk in sync with DB
        try:
            rollback_old = sanitize_tainted_path(validate_path(old_path))
            rollback_new = sanitize_tainted_path(validate_path(new_path))
            if rollback_old != "/" and rollback_new != "/":
                os.rename(rollback_new, rollback_old)
        except Exception as fs_err:

            import logging
            logger = logging.getLogger(__name__)
            logger.critical(f"Critical: Physical file renamed but database commit failed AND physical rollback failed. Disk: {new_path}, DB: {old_path}. Error: {fs_err}")
        raise HTTPException(status_code=500, detail=f"Database update failed. File rename rolled back. Error: {str(db_err)}")

    return {
        "message": "File renamed successfully",
        "old_filename": old_filename,
        "new_filename": safe_new_filename,
        "new_path": new_path
    }


@router.post("/{entry_id}/revert-rename", dependencies=[Depends(verify_api_key)])
def revert_library_file_rename(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    """Physically revert the last rename operation for this library entry."""
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    latest_rename = (
        db.query(FileNamingHistory)
        .filter(
            FileNamingHistory.library_entry_id == entry_id,
            FileNamingHistory.old_path.isnot(None)
        )
        .order_by(FileNamingHistory.timestamp.desc(), FileNamingHistory.id.desc())
        .first()
    )

    if not latest_rename:
        raise HTTPException(status_code=400, detail="No previous naming history found to revert to.")

    current_path = entry.file_path
    target_path = latest_rename.old_path

    if not os.path.exists(current_path):
        raise HTTPException(status_code=404, detail=f"Current file not found on disk at: {current_path}")

    if os.path.exists(target_path) and target_path != current_path:
        raise HTTPException(status_code=400, detail="Target file path already exists on disk, cannot revert.")

    try:
        os.rename(current_path, target_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to physically revert file rename: {str(e)}")

    # Update database
    try:
        entry.file_path = target_path

        # Log the reversion as a new action for a complete history trail
        history = FileNamingHistory(
            library_entry_id=entry.id,
            old_path=current_path,
            new_path=target_path,
            old_filename=os.path.basename(current_path),
            new_filename=os.path.basename(target_path),
            reason="revert"
        )
        db.add(history)
        db.commit()
    except Exception as db_err:
        db.rollback()
        # Roll back physical rename to keep disk in sync with DB
        try:
            os.rename(target_path, current_path)
        except Exception as fs_err:
            import logging
            logger = logging.getLogger(__name__)
            logger.critical(f"Critical: Physical file reverted but database commit failed AND physical rollback failed. Disk: {current_path}, DB: {target_path}. Error: {fs_err}")
        raise HTTPException(status_code=500, detail=f"Database update failed. File reversion rolled back. Error: {str(db_err)}")

    return {
        "message": "File rename reverted successfully",
        "reverted_to": os.path.basename(target_path),
        "path": target_path
    }


@router.get("/{entry_id}/naming-history", dependencies=[Depends(verify_api_key)])
def get_library_file_naming_history(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "view"))):
    """Fetch the complete historical trace of file names and paths for this entry."""
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    history = (
        db.query(FileNamingHistory)
        .filter(FileNamingHistory.library_entry_id == entry_id)
        .order_by(FileNamingHistory.timestamp.desc(), FileNamingHistory.id.desc())
        .all()
    )

    return [
        {
            "id": h.id,
            "old_path": h.old_path,
            "new_path": h.new_path,
            "old_filename": h.old_filename,
            "new_filename": h.new_filename,
            "reason": h.reason,
            "timestamp": h.timestamp
        }
        for h in history
    ]


class ImportManualRequest(BaseModel):
    provider_id: Optional[int] = None
    title: str
    file_path: str
    performers: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    resolution: Optional[str] = None
    studio_id: Optional[int] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None


@router.post("/import/manual", dependencies=[Depends(verify_api_key)])
def import_manual_entry(req: ImportManualRequest, db: Session = Depends(get_db), current_user = Depends(require_permission("library", "edit"))):
    """Manually register an individual file path or stream URL directly into the library."""
    # 1. Path/URL Validation
    path_or_url = req.file_path.strip()
    if not path_or_url:
        raise HTTPException(status_code=400, detail="Invalid target file path or stream URL")

    # If it is a web URL stream (e.g. .m3u8, .mpd or mp4 stream), skip local file checks
    is_stream_url = any(path_or_url.startswith(prefix) for prefix in ["http://", "https://", "rtmp://", "rtsp://"])

    if not is_stream_url:
        # Standard local file path checks
        # SECURITY: Normalize and check against media roots
        clean_path = sanitize_tainted_path(validate_path(path_or_url))
        if clean_path == "/" or not os.path.exists(clean_path):
            raise HTTPException(status_code=400, detail=f"Physical file does not exist on disk: {path_or_url}")
        
        media_roots = get_media_roots()
        is_valid_dir = False
        for root in media_roots:
            root_abs = os.path.abspath(os.path.normpath(root))
            if clean_path.startswith(root_abs + os.sep) or clean_path == root_abs:
                is_valid_dir = True
                break

        if not is_valid_dir:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Cannot import files outside of the configured media roots.",
            )
        
        if os.path.isdir(clean_path):
            # User selected a directory! Recursively scan all subdirectories and import contained media files
            media_exts = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mp3", ".m4a", ".flac", ".wav", ".aac", ".ogg"}
            provider_id = req.provider_id
            if not provider_id:
                from models import Provider
                default_provider = db.query(Provider).filter(Provider.name == "Local / General").first()
                if not default_provider:
                    default_provider = Provider(name="Local / General", base_url="local://", description="Default provider for direct file picker imports")
                    db.add(default_provider)
                    db.commit()
                    db.refresh(default_provider)
                provider_id = default_provider.id

            imported_count = 0
            skipped_count = 0
            for root_dir, _, files in os.walk(clean_path):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in media_exts:
                        full_file_path = os.path.join(root_dir, f)
                        existing_file = db.query(LibraryEntry).filter(LibraryEntry.file_path == full_file_path).first()
                        if existing_file:
                            skipped_count += 1
                            continue
                        
                        file_title = os.path.splitext(f)[0].replace("_", " ").replace("-", " ")
                        try:
                            f_size = os.path.getsize(full_file_path)
                        except Exception:
                            f_size = 0

                        new_entry = LibraryEntry(
                            provider_id=provider_id,
                            title=file_title,
                            file_path=full_file_path,
                            performers=req.performers or [],
                            tags=req.tags or [],
                            duration=0,
                            file_size=f_size,
                            adheres_to_naming_scheme=False,
                            has_metadata_match=False
                        )
                        db.add(new_entry)
                        imported_count += 1

            if imported_count > 0:
                db.commit()

            return {
                "message": f"Successfully imported {imported_count} media files recursively ({skipped_count} skipped duplicates).",
                "imported_count": imported_count,
                "skipped_count": skipped_count
            }

        # Pull file stats if not provided
        if not req.file_size:
            try:
                req.file_size = os.path.getsize(clean_path)
            except Exception:
                pass
        path_or_url = clean_path

    # 2. Check for duplicate imports
    existing = db.query(LibraryEntry).filter(LibraryEntry.file_path == path_or_url).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"This target has already been registered in the library as ID {existing.id}."
        )

    # 3. Resolve Provider ID (Fallback to Local/General provider if not specified)
    provider_id = req.provider_id
    if not provider_id:
        from models import Provider
        default_provider = db.query(Provider).filter(Provider.name == "Local / General").first()
        if not default_provider:
            default_provider = Provider(name="Local / General", base_url="local://", description="Default provider for direct file picker imports")
            db.add(default_provider)
            db.commit()
            db.refresh(default_provider)
        provider_id = default_provider.id

    # 4. Create Library Entry
    entry = LibraryEntry(
        provider_id=provider_id,
        title=req.title.strip(),
        file_path=path_or_url,
        performers=req.performers or [],
        tags=req.tags or [],
        resolution=req.resolution or "1080p",
        studio_id=req.studio_id,
        duration=req.duration or 0,
        file_size=req.file_size or 0,
        adheres_to_naming_scheme=False,
        has_metadata_match=False,
        entry_metadata={"source": "manual_import", "is_stream": is_stream_url}
    )

    try:
        db.add(entry)
        db.commit()
        db.refresh(entry)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register import: {str(e)}")

    # 4. Asynchronously queue auto-tagging if not a remote stream
    if not is_stream_url:
        try:
            auto_tag_video_task.delay(entry.id)
        except Exception:
            pass # Celery might not be active, fail silently

    return {
        "message": "Manual import registered successfully",
        "id": entry.id,
        "title": entry.title,
        "path": entry.file_path
    }


@router.get("/fs/explore", dependencies=[Depends(verify_api_key)])
def filesystem_explore(path: Optional[str] = None):
    """Explore files and directories within media roots for autocomplete and tree views."""
    media_roots = get_media_roots()
    if not media_roots:
        return {"current_path": "", "parent_path": None, "dirs": [], "files": []}

    # Normalize target path
    if path:
        try:
            target_path = sanitize_tainted_path(validate_path(path.strip()))
        except HTTPException:
            target_path = os.path.abspath(os.path.normpath(media_roots[0]))
    else:
        # Default to first media root if none specified
        target_path = sanitize_tainted_path(validate_path(media_roots[0]))

    # Security: Ensure target path resides inside one of the configured media roots
    is_valid_dir = False
    for root in media_roots:
        root_abs = os.path.abspath(os.path.normpath(root))
        if target_path.startswith(root_abs + os.sep) or target_path == root_abs:
            is_valid_dir = True
            break

    if not is_valid_dir:
        # Fall back to default root if request attempted path traversal outside media storage
        target_path = sanitize_tainted_path(validate_path(media_roots[0]))

    if not os.path.exists(target_path) or not os.path.isdir(target_path):
        return {"current_path": target_path, "parent_path": None, "dirs": [], "files": []}

    # Determine if we can move up to a parent directory (still restricted by media roots boundaries)
    parent_path = os.path.abspath(os.path.join(target_path, os.pardir))
    can_go_up = False
    for root in media_roots:
        root_abs = os.path.abspath(os.path.normpath(root))
        if parent_path.startswith(root_abs + os.sep) or parent_path == root_abs:
            can_go_up = True
            break

    dirs_list = []
    files_list = []

    try:
        clean_target = sanitize_tainted_path(target_path)
        for entry in os.scandir(clean_target):

            if entry.name.startswith("."):
                continue # Skip hidden files
            
            if entry.is_dir():
                dirs_list.append({
                    "name": entry.name,
                    "path": entry.path
                })
            elif entry.is_file():
                # Allow video, audio and playlist extensions
                ext = os.path.splitext(entry.name)[1].lower()
                allowed_exts = [
                    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".m3u8", ".mpd", 
                    ".ts", ".mp3", ".wav", ".flac", ".m4a", ".aac"
                ]
                if ext in allowed_exts:
                    files_list.append({
                        "name": entry.name,
                        "path": entry.path,
                        "size": entry.stat().st_size
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan directory: {str(e)}")

    # Sort names alphabetically
    dirs_list.sort(key=lambda d: d["name"].lower())
    files_list.sort(key=lambda f: f["name"].lower())

    return {
        "current_path": target_path,
        "parent_path": parent_path if can_go_up else None,
        "dirs": dirs_list,
        "files": files_list,
        "media_roots": media_roots
    }


