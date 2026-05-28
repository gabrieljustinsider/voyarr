from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry

router = APIRouter(
    prefix="/deovr", tags=["deovr"]
)


@router.get("")
def deovr_index(request: Request, db: Session = Depends(get_db)):
    entries = db.query(LibraryEntry).all()
    scenes = []
    for entry in entries:
        thumbnail = ""
        if entry.entry_metadata and isinstance(entry.entry_metadata, dict):
            thumbnail = entry.entry_metadata.get("thumbnail_url") or entry.entry_metadata.get("poster") or ""
        
        scenes.append({
            "name": entry.title,
            "videoUrl": f"{request.base_url}library/{entry.id}/stream",
            "thumbnailUrl": thumbnail,
            "duration": entry.duration or 0,
            "isFree": True
        })
    return {"scenes": scenes}
