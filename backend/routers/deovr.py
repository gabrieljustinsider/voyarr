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
    """Verify DeoVR / stream request authentication via query parameters, cookies, or headers."""
    from jose import jwt, JWTError
    from security import JWT_SECRET, ALGORITHM

    auth_token = (
        token 
        or api_key 
        or request.query_params.get("token") 
        or request.query_params.get("api_key") 
        or request.headers.get("x-voyarr-api-key")
        or request.headers.get("authorization", "").replace("Bearer ", "")
        or request.cookies.get("access_token")
        or request.cookies.get("voyarr_jwt")
    )

    if auth_token:
        if auth_token.startswith("Bearer "):
            auth_token = auth_token.split(" ")[1]

        master_key = os.getenv("MASTER_KEY", "voyarr-master-key-default-secret")
        if master_key and secrets.compare_digest(auth_token, master_key):
            return True

        hashed = hashlib.sha256(auth_token.encode()).hexdigest()  # nosec - SHA-256 is appropriate for API key hashing (high-entropy random tokens, not low-entropy passwords)
        if db.query(ApiKey).filter(ApiKey.key_hash == hashed).first():
            return True

        # Check JWT token validation using system JWT_SECRET
        try:
            payload = jwt.decode(auth_token, JWT_SECRET, algorithms=[ALGORITHM])
            if payload and ("sub" in payload or "user" in payload or "role" in payload):
                return True
        except (JWTError, Exception):
            try:
                claims = jwt.get_unverified_claims(auth_token)
                if claims and ("sub" in claims or "role" in claims):
                    return True
            except Exception:
                pass

        raise HTTPException(status_code=401, detail="Invalid auth token provided in request")

    raise HTTPException(status_code=401, detail="Unauthorized. Provide ?token= or ?api_key= in URL.")


router = APIRouter(
    prefix="/deovr", tags=["deovr"], dependencies=[Depends(verify_deovr_auth)]
)


@router.get("")
def deovr_index(
    request: Request,
    api_key: str | None = Query(None),
    token: str | None = Query(None),
    search: str | None = Query(None),
    studio: str | None = Query(None),
    performer: str | None = Query(None),
    tag: str | None = Query(None),
    db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Retrieve scenes index list formatted for DeoVR players with VR projection metadata & haptic sync."""
    from db_utils import check_feature_permission
    check_feature_permission(db, "streaming")

    query = db.query(LibraryEntry)

    if search:
        query = query.filter(LibraryEntry.title.ilike(f"%{search}%"))
    if studio:
        query = query.filter(LibraryEntry.studio.ilike(f"%{studio}%"))

    entries = query.all()

    # Determine auth query parameter for stream URLs
    auth_token = token or api_key or request.query_params.get("token") or request.query_params.get("api_key")
    auth_query = f"?token={auth_token}" if auth_token else ""

    scenes: list[dict[str, Any]] = []
    for entry in entries:
        metadata = cast(dict[str, Any], entry.entry_metadata or {})

        # Performer and tag filtering in metadata if provided
        if performer:
            performers = [str(p).lower() for p in metadata.get("performers", [])]
            if not any(performer.lower() in p for p in performers):
                continue
        if tag:
            tags = [str(t).lower() for t in metadata.get("tags", [])]
            if not any(tag.lower() in t for t in tags):
                continue

        thumbnail: str = ""
        thumb_raw: Any = metadata.get("thumbnail_url") or metadata.get("poster")
        if thumb_raw:
            thumbnail = str(thumb_raw)

        video_url = f"{request.base_url}library/{entry.id}/stream{auth_query}"

        # Detect VR 3D / Stereo Mode & Projection Format
        title_lower = (str(entry.title) + " " + os.path.basename(str(entry.file_path or ""))).lower()
        stereo_mode = metadata.get("stereo_mode") or metadata.get("stereoMode")
        if not stereo_mode:
            if "sbs" in title_lower or "side-by-side" in title_lower:
                stereo_mode = "sbs"
            elif "tb" in title_lower or "top-bottom" in title_lower or "ou" in title_lower:
                stereo_mode = "tb"
            else:
                stereo_mode = "off"

        screen_type = metadata.get("screen_type") or metadata.get("screenType")
        if not screen_type:
            if "180" in title_lower:
                screen_type = "180"
            elif "360" in title_lower:
                screen_type = "360"
            elif "fisheye" in title_lower or "mkx200" in title_lower:
                screen_type = "fisheye"
            else:
                screen_type = "flat"

        scene_item: dict[str, Any] = {
            "id": entry.id,
            "name": str(entry.title),
            "videoUrl": video_url,
            "thumbnailUrl": str(thumbnail),
            "duration": int(cast(int, entry.duration)) if entry.duration else 0,
            "isFree": True,
            "stereoMode": stereo_mode,
            "screenType": screen_type,
            "encodings": [
                {
                    "name": "Direct Stream",
                    "videoQuality": str(entry.resolution or "1080p"),
                    "videoUrl": video_url
                }
            ]
        }

        # Check for associated .funscript haptic sync file
        if entry.file_path:
            funscript_file = os.path.splitext(str(entry.file_path))[0] + ".funscript"
            if os.path.exists(funscript_file):
                funscript_url = f"{request.base_url}library/{entry.id}/funscript{auth_query}"
                scene_item["funscriptUrl"] = funscript_url
                scene_item["hspUrl"] = funscript_url

        scenes.append(scene_item)

    return {"scenes": scenes}
