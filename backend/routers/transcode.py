import os
import signal
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import LibraryEntry, TranscodingQueue
from tasks.transcode_tasks import transcode_video_task
from pydantic import BaseModel
from typing import Optional
from celery_app import celery_app
from dependencies import verify_api_key
from rate_limiter import rate_limit
from db_utils import get_db_session

router = APIRouter(
    prefix="/transcode", tags=["transcode"], dependencies=[Depends(verify_api_key)]
)


class TranscodeRequest(BaseModel):
    target_codec: Optional[str] = "h265"
    priority: Optional[int] = 0


@router.post(
    "/{library_entry_id}",
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def start_transcode(
    library_entry_id: int,
    req: TranscodeRequest,
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    """
    Adds a video from the library to the transcoding queue.
    """
    from db_utils import check_feature_permission
    from models import User
    user = None
    if auth_info.get("type") == "jwt" and auth_info.get("user"):
        user = db.query(User).filter(User.username == auth_info.get("user")).first()
    check_feature_permission(db, "streaming", user)

    library_entry = (
        db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
    )
    if not library_entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    # Create a new transcoding job
    new_job = TranscodingQueue(
        library_entry_id=library_entry_id,
        target_codec=req.target_codec,
        priority=req.priority or 0,
        status="pending",
    )
    db.add(new_job)

    try:
        db.commit()
        db.refresh(new_job)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An active transcode job for this item already exists.",
        )

    # Dispatch the Celery task and save its ID
    celery_task = transcode_video_task.delay(new_job.id)
    new_job.celery_task_id = celery_task.id
    db.commit()

    return {
        "message": "Transcoding job started",
        "job_id": new_job.id,
        "celery_task_id": celery_task.id,
    }


@router.get("/")
def get_transcode_jobs(
    status: Optional[str] = None,
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    """
    Retrieves all transcoding jobs, optionally filtered by status.
    """
    from db_utils import check_feature_permission
    from models import User
    user = None
    if auth_info.get("type") == "jwt" and auth_info.get("user"):
        user = db.query(User).filter(User.username == auth_info.get("user")).first()
    check_feature_permission(db, "streaming", user)

    query = db.query(TranscodingQueue).order_by(
        TranscodingQueue.priority.desc(), TranscodingQueue.created_at.asc()
    )
    if status:
        query = query.filter(TranscodingQueue.status == status)
    return query.all()


@router.get("/stream")
def stream_transcode_queue(request: Request, auth_info: dict = Depends(verify_api_key)):
    """
    SSE stream for active transcoding tasks.
    """
    with get_db_session() as db:
        from db_utils import check_feature_permission
        from models import User
        user = None
        if auth_info.get("type") == "jwt" and auth_info.get("user"):
            user = db.query(User).filter(User.username == auth_info.get("user")).first()
        check_feature_permission(db, "streaming", user)

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            with get_db_session() as db:
                jobs = (
                    db.query(TranscodingQueue)
                    .filter(
                        TranscodingQueue.status.in_(["pending", "running", "paused"])
                    )
                    .order_by(
                        TranscodingQueue.priority.desc(),
                        TranscodingQueue.created_at.asc(),
                    )
                    .all()
                )
                data = [
                    {
                        "id": j.id,
                        "library_entry_id": j.library_entry_id,
                        "title": j.library_entry.title
                        if j.library_entry
                        else f"Entry {j.library_entry_id}",
                        "status": j.status,
                        "progress_percentage": float(j.progress_percentage or 0.0),
                        "priority": j.priority,
                        "target_codec": j.target_codec,
                        "details": j.details,
                    }
                    for j in jobs
                ]
                yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{job_id}/pause")
def pause_transcode(job_id: int, db: Session = Depends(get_db)):
    """
    Suspends a running transcoding task via SIGSTOP signal.
    """
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcoding job not found")
    if job.status != "running":
        raise HTTPException(status_code=400, detail="Only running jobs can be paused")

    job.status = "paused"
    db.commit()

    if job.pid:
        try:
            os.kill(job.pid, signal.SIGSTOP)
        except Exception as e:
            print(f"Failed to pause ffmpeg process {job.pid}: {e}")

    return {"message": "Transcoding job paused successfully"}


@router.post("/{job_id}/resume")
def resume_transcode(job_id: int, db: Session = Depends(get_db)):
    """
    Resumes a suspended transcoding task via SIGCONT signal.
    """
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcoding job not found")
    if job.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused jobs can be resumed")

    job.status = "running"
    db.commit()

    if job.pid:
        try:
            os.kill(job.pid, signal.SIGCONT)
        except Exception as e:
            print(f"Failed to resume ffmpeg process {job.pid}: {e}")

    return {"message": "Transcoding job resumed successfully"}


@router.post("/{job_id}/cancel")
def cancel_transcode(job_id: int, db: Session = Depends(get_db)):
    """
    Termines a transcoding job and cleans up temp files.
    """
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcoding job not found")

    job.status = "cancelled"

    # 1. Kill active ffmpeg process
    if job.pid:
        try:
            os.kill(job.pid, signal.SIGKILL)
        except Exception:
            pass

    # 2. Revoke active Celery task
    if job.celery_task_id:
        try:
            celery_app.control.revoke(
                job.celery_task_id, terminate=True, signal="SIGKILL"
            )
        except Exception as e:
            print(f"Error revoking transcoding celery task: {e}")

    db.commit()

    # Temp file cleanup is done in the transcode_video_task's try/except/finally block,
    # but we can do a fallback here if the entry path exists
    try:
        if job.library_entry and job.library_entry.file_path:
            file_dir, file_name = os.path.split(job.library_entry.file_path)
            file_base, _ = os.path.splitext(file_name)
            output_filename = f"{file_base}.{job.target_codec}.mkv"
            output_path = os.path.join(file_dir, output_filename)
            temp_output_path = output_path + ".tmp"
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)
    except Exception as e:
        print(f"Failed to cleanup transcoding temp file: {e}")

    return {"message": "Transcoding job cancelled"}


@router.post("/{job_id}/priority/up")
def transcode_priority_up(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.priority += 1
    db.commit()
    return {
        "message": f"Job priority bumped to {job.priority}",
        "priority": job.priority,
    }


@router.post("/{job_id}/priority/down")
def transcode_priority_down(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.priority -= 1
    db.commit()
    return {
        "message": f"Job priority reduced to {job.priority}",
        "priority": job.priority,
    }


@router.delete("/{job_id}")
def delete_transcode_job(job_id: int, db: Session = Depends(get_db)):
    """
    Removes a transcoding job from the queue.
    """
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "running" or job.status == "paused":
        # First trigger cancel to release lock, kill process, and clean up
        cancel_transcode(job_id, db)

    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}
