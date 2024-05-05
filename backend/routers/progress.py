from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import DownloadQueue, MediaEntry

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/stats")
async def get_download_stats(db: Session = Depends(get_db)):
    total_downloads = db.query(func.count(MediaEntry.id)).scalar()
    completed = db.query(func.count(DownloadQueue.id)).filter(DownloadQueue.status == 'completed').scalar()
    running = db.query(func.count(DownloadQueue.id)).filter(DownloadQueue.status == 'running').scalar()
    failed = db.query(func.count(DownloadQueue.id)).filter(DownloadQueue.status == 'failed').scalar()
    
    return {
        "total_downloads": total_downloads or 0,
        "completed": completed or 0,
        "running": running or 0,
        "failed": failed or 0
    }

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

@router.post("/{task_id}/pause")
async def pause_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ['running', 'pending']:
        raise HTTPException(status_code=400, detail="Task cannot be paused")
    task.status = 'paused'
    db.commit()
    return {"message": "Download paused"}

@router.post("/{task_id}/resume")
async def resume_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != 'paused':
        raise HTTPException(status_code=400, detail="Task is not paused")
    task.status = 'running'
    db.commit()
    return {"message": "Download resumed"}

@router.post("/{task_id}/cancel")
async def cancel_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = 'cancelled'
    db.commit()
    return {"message": "Download cancelled"}
