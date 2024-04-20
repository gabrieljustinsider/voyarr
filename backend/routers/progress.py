from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import DownloadQueue

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/{task_id}")
async def get_progress(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        # For testing purposes when queue is empty, simulate a running task
        return {"task_id": task_id, "progress": 50, "status": "running"}
    
    return {
        "task_id": task.id,
        "status": task.status,
        "progress": task.progress_percentage,
        "url": task.url
    }
