from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import DownloadQueue, MediaEntry, DownloadPreference
from dependencies import verify_api_key
from celery_app import celery_app
from tasks.download_tasks import real_download_task

router = APIRouter(
    prefix="/progress", tags=["progress"], dependencies=[Depends(verify_api_key)]
)


@router.get("/stats")
def get_download_stats(db: Session = Depends(get_db)):
    total_downloads = db.query(func.count(MediaEntry.id)).scalar()
    completed = (
        db.query(func.count(DownloadQueue.id))
        .filter(DownloadQueue.status == "completed")
        .scalar()
    )
    running = (
        db.query(func.count(DownloadQueue.id))
        .filter(DownloadQueue.status == "running")
        .scalar()
    )
    failed = (
        db.query(func.count(DownloadQueue.id))
        .filter(DownloadQueue.status == "failed")
        .scalar()
    )
    queued = (
        db.query(func.count(DownloadQueue.id))
        .filter(DownloadQueue.status == "queued")
        .scalar()
    )

    return {
        "total_downloads": total_downloads or 0,
        "completed": completed or 0,
        "running": running or 0,
        "failed": failed or 0,
        "queued": queued or 0,
    }


@router.get("/{task_id}")
def get_progress(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "task_id": task.id,
        "status": task.status,
        "progress": float(task.progress_percentage or 0.0),
        "url": task.url,
        "priority": task.priority,
    }


@router.post("/{task_id}/pause")
def pause_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ["running", "pending", "queued"]:
        raise HTTPException(status_code=400, detail="Task cannot be paused")

    # Set status
    task.status = "paused"

    # Revoke active Celery worker task if running
    if task.celery_task_id:
        try:
            celery_app.control.revoke(
                task.celery_task_id, terminate=True, signal="SIGTERM"
            )
        except Exception as e:
            print(f"Error revoking celery task: {e}")

    db.commit()
    return {"message": "Download paused"}


@router.post("/{task_id}/resume")
def resume_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "paused":
        raise HTTPException(status_code=400, detail="Task is not paused")

    task.status = "pending"
    db.commit()

    # Reconstruct preferences to spawn a new celery download worker
    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == task.media_entry.provider_id)
        .first()
    )
    prefs_dict = {
        "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
        "append_metadata": prefs.append_metadata if prefs else False,
        "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None,
    }
    metadata = task.media_entry.media_metadata or {}

    # Fire Celery task
    celery_task = real_download_task.delay(task.id, prefs_dict, metadata)
    task.celery_task_id = celery_task.id
    db.commit()

    return {"message": "Download resumed", "celery_task_id": celery_task.id}


@router.post("/{task_id}/cancel")
def cancel_download(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "cancelled"

    # Revoke active Celery task
    if task.celery_task_id:
        try:
            celery_app.control.revoke(
                task.celery_task_id, terminate=True, signal="SIGTERM"
            )
        except Exception as e:
            print(f"Error revoking celery task: {e}")

    db.commit()
    return {"message": "Download cancelled"}


@router.post("/{task_id}/priority/up")
def priority_up(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.priority += 1
    db.commit()
    return {
        "message": f"Task priority bumped to {task.priority}",
        "priority": task.priority,
    }


@router.post("/{task_id}/priority/down")
def priority_down(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.priority -= 1
    db.commit()
    return {
        "message": f"Task priority reduced to {task.priority}",
        "priority": task.priority,
    }
