from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry
from typing import Any, cast

router = APIRouter(
    prefix="/deovr", tags=["deovr"]
)


@router.get("")
def deovr_index(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    entries = db.query(LibraryEntry).all()
    scenes: list[dict[str, Any]] = []
    for entry in entries:
        thumbnail: str = ""
        if entry.entry_metadata:  # type: ignore
            metadata = cast(dict[str, Any], entry.entry_metadata)
            thumb_raw: Any = metadata.get("thumbnail_url") or metadata.get("poster")
            thumbnail = str(thumb_raw) if thumb_raw else ""
        
        scenes.append(cast(dict[str, Any], {
            "name": str(entry.title),
            "videoUrl": f"{request.base_url}library/{entry.id}/stream",
            "thumbnailUrl": str(thumbnail),
            "duration": int(cast(int, entry.duration)) if entry.duration else 0,  # type: ignore
            "isFree": True
        }))
    return {"scenes": scenes}
