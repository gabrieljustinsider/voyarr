from fastapi import Header, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
import os
import hashlib

async def verify_api_key(
    x_voyarr_api_key: str = Header(None),
    api_key: str = Query(None, alias="api_key"),
    db: Session = Depends(get_db)
):
    """
    Secures endpoints by requiring an API key either via header or query parameter.
    """
    expected_key = os.getenv("MASTER_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=500, 
            detail="Critical Error: MASTER_KEY environment variable is not set on the server."
        )
    
    provided_key = x_voyarr_api_key or api_key
    
    if not provided_key:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Missing API key."
        )
    
    if provided_key == expected_key:
        return provided_key
        
    # Fallback to checking the ApiKey database table for scoped external tools
    try:
        from models import ApiKey
        hashed_key = hashlib.sha256(provided_key.encode()).hexdigest()
        db_key = db.query(ApiKey).filter(ApiKey.key_hash == hashed_key).first()
        if db_key:
            db_key.last_used = datetime.utcnow()
            db.commit()
            return provided_key
    except ImportError:
        pass # Model might not be defined or available yet

    raise HTTPException(
        status_code=403, 
        detail="Forbidden: Invalid API key."
    )