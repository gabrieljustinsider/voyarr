from fastapi import Header, Query, HTTPException
import os

async def verify_api_key(
    x_voyarr_api_key: str = Header(None),
    api_key: str = Query(None, alias="api_key")
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
    
    if not provided_key or provided_key != expected_key:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Invalid or missing API key."
        )
    
    return provided_key