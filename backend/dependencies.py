from fastapi import Header, Query, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
import os
import hashlib
import secrets
from jose import jwt, JWTError
from security import JWT_SECRET, ALGORITHM
from typing import Any


async def verify_api_key(
    request: Request,
    x_voyarr_api_key: str | None = Header(None),
    api_key: str | None = Query(None, alias="api_key"),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Secures endpoints by requiring EITHER:
    1. A valid JWT Bearer Token (Authorization header)
    2. A valid JWT token in an HTTP-only cookie (access_token)
    3. A Master API Key (X-Voyarr-Api-Key header or api_key query param)
    4. A Scoped API Key (from the database)
    """

    token = None

    # 1. Check for JWT in Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    # 2. Check for JWT in cookie (Fallback for session persistence)
    if not token:
        token = request.cookies.get("access_token")

    # 2b. Check for JWT in query parameters (WebSockets auth)
    if not token:
        token = request.query_params.get("token")

    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if isinstance(username, str) and username:
                return {"type": "jwt", "user": username, "role": payload.get("role")}
        except JWTError:
            pass  # Fallback to API Key check if JWT is invalid/expired

    # 3. Check for Master API Key
    expected_key = os.getenv("MASTER_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail="Critical Error: MASTER_KEY environment variable is not set on the server.",
        )

    provided_key = x_voyarr_api_key or api_key

    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if secrets.compare_digest(provided_key, expected_key):
        return {"type": "master_key"}

    # 4. Fallback to Scoped API Keys (from database)
    try:
        from models import ApiKey

        hashed_key = hashlib.sha256(provided_key.encode()).hexdigest()
        db_key = db.query(ApiKey).filter(ApiKey.key_hash == hashed_key).first()
        if db_key:
            setattr(db_key, "last_used", datetime.now(timezone.utc).replace(tzinfo=None))
            db.commit()
            key_name = getattr(db_key, "name", "unknown")
            return {"type": "scoped_key", "name": key_name}
    except ImportError:
        pass  # Model might not be defined yet in some contexts

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid API key or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_permission(module: str, required_level: str):
    """
    Dependency factory to enforce granular module-level access control.
    Usage: current_user = Depends(require_permission("library", "edit"))
    """
    def permission_checker(
        auth_info: dict[str, Any] = Depends(verify_api_key),
        db: Session = Depends(get_db)
    ):
        from db_utils import check_feature_permission

        # 1. Master Key and Admins bypass all restrictions automatically
        if auth_info.get("type") == "master_key" or auth_info.get("role") == "admin":
            if module in ["streaming", "scraping", "ripping"]:
                check_feature_permission(db, module, auth_info)
            return auth_info

        username = auth_info.get("user")
        if not username:
            raise HTTPException(status_code=403, detail="Forbidden")

        from models import User
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if module in ["streaming", "scraping", "ripping"]:
            check_feature_permission(db, module, user)

        user_permissions = user.permissions or {}
        
        # 2. Extract access level, falling back to legacy formats if needed
        user_level_str = user_permissions.get(module, "none")
        
        legacy_map = {"streaming": "can_stream", "scraping": "can_scrape", "ripping": "can_rip"}
        if module in legacy_map and legacy_map[module] in user_permissions:
            if user_permissions[legacy_map[module]] is True and user_level_str == "none":
                user_level_str = "edit" if module != "streaming" else "view"
        
        # 3. Check access hierarchy
        access_hierarchy = {"none": 0, "view": 1, "edit": 2}
        if access_hierarchy.get(user_level_str, 0) < access_hierarchy.get(required_level, 1):
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. You require '{required_level}' access to the '{module}' module."
            )
        
        return user
    return permission_checker
