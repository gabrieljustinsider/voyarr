from fastapi import Header, HTTPException
import os

async def verify_api_key(x_voyarr_api_key: str = Header(None)):
    """
    Secures endpoints by requiring an X-Voyarr-Api-Key header matching the MASTER_KEY.
    """
    expected_key = os.getenv("MASTER_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=500, 
            detail="Critical Error: MASTER_KEY environment variable is not set on the server."
        )
    
    if not x_voyarr_api_key or x_voyarr_api_key != expected_key:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Invalid or missing X-Voyarr-Api-Key header."
        )
    
    return x_voyarr_api_key