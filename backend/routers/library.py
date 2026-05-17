from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry, DownloadPreference
from typing import Optional
import os
from services.reverse_regex import ReverseRegexMatcher
from services.hash_service import HashService
from db_utils import get_db_session

from dependencies import verify_api_key
from utils import get_media_roots
from rate_limiter import rate_limit

router = APIRouter(
    prefix="/library", tags=["library"], dependencies=[Depends(verify_api_key)]
)


@router.post(
    "/scan", dependencies=[Depends(rate_limit(max_requests=3, window_seconds=60))]
)
def scan_library(
    provider_id: int,
    directory: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Scan a directory and reverse-engineer filenames into Library entries."""

    media_roots = get_media_roots()
    target_dirs = []

    if directory:
        # SECURITY: Prevent path traversal and arbitrary directory scanning
        target_dir = os.path.realpath(directory)
        is_valid_dir = False
        for root in media_roots:
            try:
                if os.path.commonpath([root, target_dir]) == root:
                    is_valid_dir = True
                    break
            except ValueError:
                # Occurs on Windows when comparing paths across different drives
                continue
                
        if not is_valid_dir:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Cannot scan directories outside of the configured media root.",
            )
        target_dirs.append(target_dir)
    else:
        target_dirs = media_roots

    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == provider_id)
        .first()
    )
    pattern = prefs.naming_pattern if prefs else "{title}_{performers}_{resolution}"

    matcher = ReverseRegexMatcher(db)
    aggregated_result = {"added": 0, "matched": 0, "errors": []}

    for d in target_dirs:
        if not os.path.exists(d):
            continue
        result = matcher.scan_directory(d, provider_id, pattern)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        aggregated_result["added"] += result.get("added", 0)
        aggregated_result["matched"] += result.get("matched", 0)
        aggregated_result["errors"].extend(result.get("errors", []))

    return {"message": "Scan complete", "result": aggregated_result}


@router.get("/")
def get_library_entries(
    provider_id: Optional[int] = None,
    resolution: Optional[str] = None,
    tag: Optional[str] = None,
    performer: Optional[str] = None,
    ohash: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(LibraryEntry)
    if provider_id:
        query = query.filter(LibraryEntry.provider_id == provider_id)
    if resolution:
        query = query.filter(LibraryEntry.resolution == resolution)
    if tag:
        query = query.filter(LibraryEntry.tags.contains([tag]))
    if performer:
        query = query.filter(LibraryEntry.performers.contains([performer]))
    if ohash:
        query = query.filter(LibraryEntry.ohash == ohash)
        
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": items,
        "total": total,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/{entry_id}/stream")
def stream_video(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(entry.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        entry.file_path, media_type="video/mp4", headers={"Accept-Ranges": "bytes"}
    )


def process_missing_hashes_task():
    with get_db_session() as db:
        entry_ids = [
            row[0] for row in db.query(LibraryEntry.id)
            .filter((LibraryEntry.phash.is_(None)) | (LibraryEntry.phash == ""))
            .all()
        ]
        for eid in entry_ids:
            try:
                entry = db.query(LibraryEntry).get(eid)
                if not entry:
                    continue
                if os.path.exists(entry.file_path):
                    if not entry.ohash or entry.ohash == "0000000000000000":
                        entry.ohash = HashService.generate_ohash(entry.file_path)
                    entry.phash = HashService.generate_phash(entry.file_path)
                    db.commit()
            except Exception as e:
                db.rollback()
                print(f"Error rescanning hashes for entry {eid}: {str(e)}")


@router.post(
    "/rescan-hashes",
    dependencies=[Depends(rate_limit(max_requests=2, window_seconds=60))],
)
def rescan_hashes(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(process_missing_hashes_task)
    return {"message": "Hash rescan started in the background. This may take a while."}
