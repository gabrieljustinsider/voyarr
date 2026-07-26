"""DeoVR endpoint router for integration with DeoVR headset players."""

import os
import secrets
import hashlib
import time
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, Query, HTTPException, Form, Response, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sa_func

from database import get_db
from models import LibraryEntry, ApiKey, User, Studio
from security import verify_password, create_access_token, JWT_SECRET, ALGORITHM
from db_utils import check_feature_permission
from routers.auth import get_current_user


# In-memory store for DeoVR native sign-in pairing codes
# user_code -> {"user_id": str, "expires_at": float, "status": "pending"|"used"}
DEOVR_PAIRING_STORE: dict[str, dict[str, Any]] = {}


# --- Auth (exported for use by library.py stream endpoints) ---

def verify_deovr_auth(
    request: Request,
    token: str | None = Query(None),
    api_key: str | None = Query(None),
    db: Session = Depends(get_db)
):
    """Verify DeoVR / stream request authentication via query parameters, cookies, or headers."""
    from jose import jwt, JWTError

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

        hashed = hashlib.sha256(auth_token.encode()).hexdigest()  # nosec
        if db.query(ApiKey).filter(ApiKey.key_hash == hashed).first():
            return True

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


# --- Router ---

router = APIRouter(prefix="/deovr", tags=["deovr"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_auth(
    request: Request,
    token: str | None,
    api_key: str | None,
    db: Session,
) -> tuple[str | None, User | None]:
    """Resolve authentication for DeoVR requests.

    Returns (*raw_token*, *user*) — both *None* when not authenticated.
    """
    raw = (
        token
        or api_key
        or request.query_params.get("token")
        or request.query_params.get("api_key")
        or request.headers.get("x-voyarr-api-key")
        or request.headers.get("authorization", "").replace("Bearer ", "")
        or request.cookies.get("access_token")
        or request.cookies.get("voyarr_jwt")
    )
    if not raw:
        return None, None

    if raw.startswith("Bearer "):
        raw = raw.split(" ")[1]

    # Master key
    master_key = os.getenv("MASTER_KEY", "voyarr-master-key-default-secret")
    if master_key and secrets.compare_digest(raw, master_key):
        user = db.query(User).filter(User.role == "admin").first() or db.query(User).first()
        return raw, user

    # Scoped / device-pairing API key
    if db.query(ApiKey).filter(ApiKey.key_hash == hashlib.sha256(raw.encode()).hexdigest()).first():
        return raw, None

    # JWT
    from jose import jwt as jose_jwt, JWTError
    try:
        payload = jose_jwt.decode(raw, JWT_SECRET, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub and isinstance(sub, str):
            user = db.query(User).filter(User.username == sub).first()
            if user and bool(user.is_active):
                return raw, user
    except JWTError:
        pass

    return raw, None


def _build_scene_item(
    entry: LibraryEntry,
    request: Request,
    auth_query: str,
    db: Session,
) -> dict[str, Any]:
    metadata = cast(dict[str, Any], entry.entry_metadata or {})

    # --- thumbnail ---
    thumbnail: str = ""
    thumb_raw: Any = metadata.get("thumbnail_url") or metadata.get("poster")
    if thumb_raw:
        thumbnail = str(thumb_raw)

    video_url = f"{request.base_url}library/{entry.id}/stream{auth_query}"

    # --- VR 3D / projection ---
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

    # --- resolution ---
    try:
        res_int = int(str(entry.resolution or "1080").replace("p", "").replace("K", "000"))
    except (ValueError, TypeError):
        res_int = 1080

    # --- performers / tags / categories ---
    performers_list: list[str] = cast(list[str], metadata.get("performers", entry.performers or []))
    tags_list: list[str] = cast(list[str], metadata.get("tags", entry.tags or []))
    categories_list: list[str] = cast(list[str], metadata.get("categories", []))
    if not categories_list and entry.studio is not None:
        categories_list = [entry.studio.name]
    elif not categories_list:
        categories_list = tags_list[:]

    # --- additional images ---
    images_list: list[str] = cast(list[str], metadata.get("images", []))
    if not images_list:
        raw_screenshots = metadata.get("screenshots") or metadata.get("gallery")
        if isinstance(raw_screenshots, list):
            images_list = [str(s) for s in raw_screenshots]

    # --- preview ---
    preview_url: str | None = metadata.get("preview_url") or metadata.get("previewUrl")

    # --- dates / rating / description ---
    date_added = str(entry.created_at.date()) if entry.created_at else ""
    rating = round(float(metadata.get("rating", 0) or 0), 2)
    description: str = metadata.get("description", "") or ""

    # --- build item ---
    item: dict[str, Any] = {
        "title": str(entry.title),
        "id": str(entry.id),
        "description": description,
        "date": date_added,
        "tags": tags_list,
        "performers": performers_list,
        "categories": categories_list,
        "thumbnailUrl": thumbnail,
        "videoLength": int(cast(int, entry.duration)) if entry.duration else 0,
        "rating": rating,
        "is3d": stereo_mode != "off",
        "stereoMode": stereo_mode,
        "screenType": screen_type,
        "videoOrientation": "landscape",
        "isFree": True,
        "encodings": [
            {
                "name": "H.264",
                "videoSources": [
                    {
                        "resolution": res_int,
                        "url": video_url,
                    }
                ],
            }
        ],
    }

    if preview_url:
        item["preview"] = preview_url
        item["previewDuration"] = 10

    if images_list:
        item["images"] = images_list

    # --- download sources ---
    if entry.file_path:
        item["downloadSources"] = [
            {
                "name": "Original",
                "resolution": res_int,
                "url": video_url.replace("/stream", "/download"),
            }
        ]

    # --- haptic / interactive ---
    if entry.file_path:
        funscript_file = os.path.splitext(str(entry.file_path))[0] + ".funscript"
        if os.path.exists(funscript_file):
            funscript_url = f"{request.base_url}library/{entry.id}/funscript{auth_query}"
            item["funscriptUrl"] = funscript_url
            item["hspUrl"] = funscript_url
            item["interactive"] = True
        else:
            item["interactive"] = False

    return item


# ---------------------------------------------------------------------------
# GET  /deovr  — scene feed
# ---------------------------------------------------------------------------

@router.get("")
def deovr_index(
    request: Request,
    api_key: str | None = Query(None),
    token: str | None = Query(None),
    search: str | None = Query(None),
    studios: str | None = Query(None),
    performers: str | None = Query(None),
    tags: str | None = Query(None),
    page: int | None = Query(None),
    itemsPerPage: int | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return the DeoVR scene feed (Selection Scene JSON).

    Supports filtering via ``search``, ``studios`` (comma-separated),
    ``performers`` and ``tags`` (comma-separated), as well as pagination
    via ``page`` and ``itemsPerPage`` (default 50).
    """
    check_feature_permission(db, "streaming")

    auth_token, user = _resolve_auth(request, token, api_key, db)
    auth_query = f"?token={auth_token}" if auth_token else ""

    query = db.query(LibraryEntry).options(joinedload(LibraryEntry.studio))

    if search:
        query = query.filter(LibraryEntry.title.ilike(f"%{search}%"))

    # Studio filter (comma-separated names, case-insensitive)
    if studios:
        studio_names = [s.strip() for s in studios.split(",") if s.strip()]
        if studio_names:
            studio_ids = (
                db.query(Studio.id)
                .filter(sa_func.lower(Studio.name).in_([n.lower() for n in studio_names]))
                .all()
            )
            studio_ids = [sid for (sid,) in studio_ids]
            if studio_ids:
                query = query.filter(LibraryEntry.studio_id.in_(studio_ids))

    entries = list(query.all())

    # Performer / tag filtering (happens in Python because fields are JSON / JSONB)
    if performers or tags:
        performer_list = [p.strip().lower() for p in performers.split(",")] if performers else []
        tag_list = [t.strip().lower() for t in tags.split(",")] if tags else []
        filtered: list[LibraryEntry] = []
        for e in entries:
            meta = cast(dict[str, Any], e.entry_metadata or {})
            e_performers = [str(p).lower() for p in (meta.get("performers", e.performers or []))]
            e_tags = [str(t).lower() for t in (meta.get("tags", e.tags or []))]
            if performer_list and not any(any(perf in ep for ep in e_performers) for perf in performer_list):
                continue
            if tag_list and not any(t in e_tags for t in tag_list):
                continue
            filtered.append(e)
        entries = filtered

    # Pagination
    total_items = len(entries)
    pp = itemsPerPage or 50
    current_page = page or 1
    total_pages = max(1, (total_items + pp - 1) // pp)
    start_idx = (current_page - 1) * pp
    end_idx = start_idx + pp
    page_entries = entries[start_idx:end_idx] if pp > 0 else entries

    if not auth_token:
        return {
            "title": "Voyarr",
            "description": "Your personal media library",
            "authorized": "0",
            "maxFreeVideos": 0,
            "scenes": [],
            "accessCount": 0,
        }

    return {
        "title": "Voyarr",
        "description": "Your personal media library",
        "authorized": "1",
        "scenes": [_build_scene_item(e, request, auth_query, db) for e in page_entries],
        "accessCount": total_items,
        "currentPage": current_page,
        "itemsPerPage": pp,
        "totalPages": total_pages,
    }


# ---------------------------------------------------------------------------
# POST /deoVR  — native DeoVR sign-in
# ---------------------------------------------------------------------------

def _build_feed(
    request: Request,
    auth_token: str | None,
    entries: list[LibraryEntry],
    db: Session,
) -> dict[str, Any]:
    auth_query = f"?token={auth_token}" if auth_token else ""
    return {
        "title": "Voyarr",
        "description": "Your personal media library",
        "authorized": "1",
        "scenes": [_build_scene_item(e, request, auth_query, db) for e in entries],
        "accessCount": len(entries),
    }


@router.post("")
def deovr_login(
    request: Request,
    response: Response,
    login: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Handle DeoVR native sign-in via ``POST login`` + ``password``.

    The ``password`` can be either a Voyarr account password (with ``login``
    being the username) **or** a 6-digit pairing code obtained from the
    desktop Account Security page (``login`` is ignored in this case).

    On success returns the full scene feed with ``authorized: "1"`` and sets
    a JWT session cookie for subsequent GET requests from the DeoVR app.
    """

    # --- Try pairing code first (6-digit numeric code from DEOVR_PAIRING_STORE) ---
    if password and password.isdigit() and len(password) >= 4:
        now = time.time()
        pair_data = DEOVR_PAIRING_STORE.get(password)
        if pair_data and pair_data["status"] == "pending" and pair_data["expires_at"] > now:
            pair_data["status"] = "used"
            user = db.query(User).filter(User.id == pair_data["user_id"]).first()
            if user and bool(user.is_active):
                from datetime import timedelta
                from routers.auth import ACCESS_TOKEN_EXPIRE_MINUTES, update_user_last_login

                access_token = create_access_token(
                    data={"sub": str(user.username), "role": str(user.role)},
                    expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
                )
                update_user_last_login(db, user)

                response.set_cookie(
                    key="access_token",
                    value=access_token,
                    httponly=True,
                    max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    secure=True,
                    samesite="lax",
                )

                entries = list(db.query(LibraryEntry).options(joinedload(LibraryEntry.studio)).all())
                return _build_feed(request, access_token, entries, db)

    # --- Fall through to normal password verification ---
    user = db.query(User).filter(sa_func.lower(User.username) == login.lower()).first()
    if not user or not verify_password(password, str(user.password_hash)):
        return {
            "title": "Voyarr",
            "description": "Your personal media library",
            "authorized": "-1",
            "scenes": [],
            "accessCount": 0,
        }

    if not bool(user.is_active):
        return {
            "title": "Voyarr",
            "description": "Your personal media library",
            "authorized": "-1",
            "scenes": [],
            "accessCount": 0,
        }

    from datetime import timedelta
    from routers.auth import ACCESS_TOKEN_EXPIRE_MINUTES, update_user_last_login

    access_token = create_access_token(
        data={"sub": str(user.username), "role": str(user.role)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    update_user_last_login(db, user)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=True,
        samesite="lax",
    )

    entries = list(db.query(LibraryEntry).options(joinedload(LibraryEntry.studio)).all())
    return _build_feed(request, access_token, entries, db)


# ---------------------------------------------------------------------------
# POST /deovr/pair  — generate a pairing code for native DeoVR sign-in
# ---------------------------------------------------------------------------

@router.post("/pair", status_code=status.HTTP_201_CREATED)
def request_deovr_pairing(
    current_user: User = Depends(get_current_user),
):
    """Generate a 6-digit pairing code for use with DeoVR native sign-in.

    Call this from the desktop Account Security page. The returned
    ``user_code`` is entered as the **password** field in the DeoVR
    sign-in form.  Codes expire after 5 minutes and are single-use.
    """
    user_code = "".join(secrets.choice("0123456789") for _ in range(6))
    expires_at = time.time() + 300  # 5 minutes

    DEOVR_PAIRING_STORE[user_code] = {
        "user_id": current_user.id,
        "expires_at": expires_at,
        "status": "pending",
    }

    return {
        "user_code": user_code,
        "expires_in": 300,
    }
