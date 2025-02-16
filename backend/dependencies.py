from fastapi import Header, Query, HTTPException, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
import os
import hashlib
import secrets
from jose import jwt, JWTError
from security import JWT_SECRET, ALGORITHM


async def verify_api_key(
    x_voyarr_api_key: str = Header(None),
    api_key: str = Query(None, alias="api_key"),
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    """
    Secures endpoints by requiring EITHER:
    1. A Master API Key (X-Voyarr-Api-Key header or api_key query param)
    2. A Scoped API Key (from the database)
    3. A valid JWT Bearer Token (Authorization header)
    """
    
    # 1. Check for JWT first (preferred for UI usage)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username:
                return {"type": "jwt", "user": username, "role": payload.get("role")}
        except JWTError:
            pass # Fallback to API Key check

    # 2. Check for Master API Key
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

    # 3. Fallback to Scoped API Keys (from database)
    try:
        from models import ApiKey

        hashed_key = hashlib.sha256(provided_key.encode()).hexdigest()
        db_key = db.query(ApiKey).filter(ApiKey.key_hash == hashed_key).first()
        if db_key:
            db_key.last_used = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            return {"type": "scoped_key", "name": db_key.name}
    except ImportError:
        pass  # Model might not be defined yet in some contexts

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid API key or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
