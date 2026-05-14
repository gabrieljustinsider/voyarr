from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import LibraryEntry, DownloadPreference
from typing import Optional
import os
from services.reverse_regex import ReverseRegexMatcher
from services.hash_service import HashService

from dependencies import verify_api_key
from rate_limiter import rate_limit
router = APIRouter(prefix="/library", tags=["library"], dependencies=[Depends(verify_api_key)])

@router.post("/scan", dependencies=[Depends(rate_limit(max_requests=3, window_seconds=60))])
def scan_library(
    provider_id: int,
    directory: str = "/media/storage/downloads",
    db: Session = Depends(get_db)
):
    """Scan a directory and reverse-engineer filenames into Library entries."""
    
    # SECURITY: Prevent path traversal and arbitrary directory scanning
    media_root = os.path.abspath(os.getenv("MEDIA_ROOT", "/media/storage"))
    target_dir = os.path.abspath(directory)
    if os.path.commonpath([media_root, target_dir]) != media_root:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot scan directories outside of the configured media root.")
        
    prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == provider_id).first()
    pattern = prefs.naming_pattern if prefs else "{title}_{performers}_{resolution}"
    
    matcher = ReverseRegexMatcher(db)
    result = matcher.scan_directory(directory, provider_id, pattern)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {"message": "Scan complete", "result": result}

@router.get("/")
def get_library_entries(
    provider_id: Optional[int] = None,
    resolution: Optional[str] = None,
    tag: Optional[str] = None,
    performer: Optional[str] = None,
    ohash: Optional[str] = None,
    db: Session = Depends(get_db)
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
    return query.all()

@router.get("/{entry_id}/stream")
def stream_video(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(entry.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(entry.file_path, media_type="video/mp4", headers={"Accept-Ranges": "bytes"})

def process_missing_hashes_task():
    db = SessionLocal()
    try:
        entries = db.query(LibraryEntry).filter(
            (LibraryEntry.phash == None) | (LibraryEntry.phash == "")
        ).all()
        for entry in entries:
            if os.path.exists(entry.file_path):
                if not entry.ohash or entry.ohash == "0000000000000000":
                    entry.ohash = HashService.generate_ohash(entry.file_path)
                entry.phash = HashService.generate_phash(entry.file_path)
                db.commit()
    finally:
        db.close()

@router.post("/rescan-hashes", dependencies=[Depends(rate_limit(max_requests=2, window_seconds=60))])
def rescan_hashes(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(process_missing_hashes_task)
    return {"message": "Hash rescan started in the background. This may take a while."}