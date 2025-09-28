from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry
from db_utils import get_or_create_studio_by_name
from pydantic import BaseModel
from typing import List, Optional
import os
from services.media_tagger import MediaTagger
import json

from dependencies import verify_api_key

router = APIRouter(
    prefix="/metadata", tags=["metadata"], dependencies=[Depends(verify_api_key)]
)


class MetadataUpdate(BaseModel):
    title: str
    performers: List[str]
    tags: List[str]
    description: Optional[str] = None
    studio: Optional[str] = None


@router.get("/entry/{entry_id}")
def get_metadata(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {
        "id": entry.id,
        "provider_id": entry.provider_id,
        "title": entry.title,
        "performers": entry.performers,
        "tags": entry.tags,
        "file_path": entry.file_path,
        "file_size": entry.file_size,
        "resolution": entry.resolution,
        "duration": entry.duration,
        "ohash": entry.ohash,
        "phash": entry.phash,
        "site_id": entry.site_id,
        "entry_metadata": entry.entry_metadata,
        "studio_id": entry.studio_id,
        "studio_name": entry.studio.name if entry.studio else None,
    }


@router.post("/entry/{entry_id}/update")
def update_metadata(entry_id: int, req: MetadataUpdate, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.title = req.title
    entry.performers = req.performers
    entry.tags = req.tags

    # Resolve studio name string to relational integer studio_id
    if req.studio is not None:
        entry.studio_id = get_or_create_studio_by_name(db, req.studio)

    meta = entry.entry_metadata or {}
    meta["description"] = req.description
    entry.entry_metadata = meta

    db.commit()
    return {"message": "Metadata updated successfully"}


@router.post("/entry/{entry_id}/write-to-file")
def write_metadata_to_file(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry or not os.path.exists(entry.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    try:
        # Attempt to embed metadata directly into the media file
        embed_meta = {
            "title": entry.title,
            "performers": entry.performers,
            "description": entry.entry_metadata.get("description")
            if entry.entry_metadata
            else None,
            "studio": entry.studio.name if entry.studio else None,
        }
        MediaTagger.tag_file(entry.file_path, embed_meta)

        # Write sidecar .json file for external players
        sidecar_path = f"{entry.file_path}.json"
        with open(sidecar_path, "w") as f:
            json.dump(embed_meta, f, indent=4)

        return {
            "message": "Metadata written successfully",
            "sidecar_file": sidecar_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
