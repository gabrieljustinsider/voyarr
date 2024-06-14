import os
from fastapi import APIRouter, Depends, HTTPException
from dependencies import verify_api_key

router = APIRouter(prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)])

@router.get("/")
def get_logs(lines: int = 200):
    log_file = os.path.join(os.getenv("MEDIA_ROOT", "/media/storage"), "logs", "celery.log")
    if not os.path.exists(log_file):
        return {"logs": ["Log file not found. Ensure the Celery worker has booted and generated logs."]}
    
    try:
        with open(log_file, "r") as f:
            all_lines = f.readlines()
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/")
def clear_logs():
    log_file = os.path.join(os.getenv("MEDIA_ROOT", "/media/storage"), "logs", "celery.log")
    if os.path.exists(log_file):
        with open(log_file, "w") as f:
            f.write("")
    return {"message": "Logs cleared"}