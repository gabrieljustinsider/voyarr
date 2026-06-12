from fastapi import APIRouter, Depends, Request, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry, ApiKey
from typing import Any, cast
import os
import secrets
import hashlib

def verify_deovr_auth(
    request: Request,
    api_key: str | None = Query(None),
    db: Session = Depends(get_db)
):
    if api_key:
        master_key = os.getenv("MASTER_KEY", "")
        if master_key and secrets.compare_digest(api_key, master_key):
            return True
        
        hashed = hashlib.sha256(api_key.encode()).hexdigest()
        if db.query(ApiKey).filter(ApiKey.key_hash == hashed).first():
            return True
            
        raise HTTPException(status_code=401, detail="Invalid API Key provided in URL")
        
    header_key = request.headers.get("x-voyarr-api-key")
    master_key = os.getenv("MASTER_KEY", "")
    if header_key and master_key and secrets.compare_digest(header_key, master_key):
        return True
        
    raise HTTPException(status_code=401, detail="Unauthorized. Provide ?api_key= in URL.")

router = APIRouter(
    prefix="/deovr", tags=["deovr"], dependencies=[Depends(verify_deovr_auth)]
)


@router.get("")
def deovr_index(request: Request, api_key: str | None = Query(None), db: Session = Depends(get_db)) -> dict[str, Any]:
    entries = db.query(LibraryEntry).all()
    scenes: list[dict[str, Any]] = []
    for entry in entries:
        thumbnail: str = ""
        if entry.entry_metadata:  # type: ignore
            metadata = cast(dict[str, Any], entry.entry_metadata)
            thumb_raw: Any = metadata.get("thumbnail_url") or metadata.get("poster")
            thumbnail = str(thumb_raw) if thumb_raw else ""
        
        video_url = f"{request.base_url}library/{entry.id}/stream"
        if api_key:
            video_url += f"?api_key={api_key}"

        scenes.append(cast(dict[str, Any], {
            "name": str(entry.title),
            "videoUrl": video_url,
            "thumbnailUrl": str(thumbnail),
            "duration": int(cast(int, entry.duration)) if entry.duration else 0,  # type: ignore
            "isFree": True
        }))
    return {"scenes": scenes}
