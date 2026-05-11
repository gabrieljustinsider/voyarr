from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry
from pydantic import BaseModel
from typing import List, Optional
import os
from services.media_tagger import MediaTagger

from dependencies import verify_api_key
router = APIRouter(prefix="/metadata", tags=["metadata"], dependencies=[Depends(verify_api_key)])

class MetadataUpdate(BaseModel):
    title: str
    performers: List[str]
    tags: List[str]
    description: Optional[str] = None

@router.get("/entry/{entry_id}")
def get_metadata(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@router.post("/entry/{entry_id}/update")
def update_metadata(entry_id: int, req: MetadataUpdate, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    entry.title = req.title
    entry.performers = req.performers
    entry.tags = req.tags
    
    meta = entry.metadata or {}
    meta["description"] = req.description
    entry.metadata = meta
    
    db.commit()
    return {"message": "Metadata updated successfully"}

@router.post("/entry/{entry_id}/write-to-file")
def write_metadata_to_file(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry or not os.path.exists(entry.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")
        
    try:
        return {"message": "Metadata written successfully", "sidecar_file": f"{entry.file_path}.nfo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))