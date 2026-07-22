"""DeoVR endpoint router for integration with DeoVR headset players."""

import os
import secrets
import hashlib
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, Query, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import LibraryEntry, ApiKey


def verify_deovr_auth(
    request: Request,
    token: str | None = Query(None),
    api_key: str | None = Query(None),
    db: Session = Depends(get_db)
):
    """Verify DeoVR / stream request authentication via query parameters or custom headers."""
    auth_token = token or api_key or request.query_params.get("token") or request.query_params.get("api_key")
    if auth_token:
        master_key = os.getenv("MASTER_KEY", "")
        if master_key and secrets.compare_digest(auth_token, master_key):
            return True

        hashed = hashlib.sha256(auth_token.encode()).hexdigest()
        if db.query(ApiKey).filter(ApiKey.key_hash == hashed).first():
            return True

        # Check JWT token validation using system JWT_SECRET
        try:
            import jwt
            from security import JWT_SECRET
            payload = jwt.decode(auth_token, JWT_SECRET, algorithms=["HS256"])
            if payload and "sub" in payload:
                return True
        except Exception:
            pass

        raise HTTPException(status_code=401, detail="Invalid auth token provided in URL")

    header_key = request.headers.get("x-voyarr-api-key") or request.headers.get("authorization", "").replace("Bearer ", "")
    master_key = os.getenv("MASTER_KEY", "")
    if header_key:
        if master_key and secrets.compare_digest(header_key, master_key):
            return True
        try:
            import jwt
            from security import JWT_SECRET
            payload = jwt.decode(header_key, JWT_SECRET, algorithms=["HS256"])
            if payload and "sub" in payload:
                return True
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Unauthorized. Provide ?token= or ?api_key= in URL.")


router = APIRouter(
    prefix="/deovr", tags=["deovr"], dependencies=[Depends(verify_deovr_auth)]
)


@router.get("")
def deovr_index(
    request: Request,
    api_key: str | None = Query(None),
    db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Retrieve scenes index list formatted for DeoVR players."""
    from db_utils import check_feature_permission
    check_feature_permission(db, "streaming")
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
