from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import LibraryEntry, TranscodingQueue
from tasks.transcode_tasks import transcode_video_task
from pydantic import BaseModel
from typing import Optional

from dependencies import verify_api_key
router = APIRouter(prefix="/transcode", tags=["transcode"], dependencies=[Depends(verify_api_key)])

class TranscodeRequest(BaseModel):
    target_codec: Optional[str] = 'h265'

@router.post("/{library_entry_id}")
def start_transcode(library_entry_id: int, req: TranscodeRequest, db: Session = Depends(get_db)):
    """
    Adds a video from the library to the transcoding queue.
    """
    library_entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
    if not library_entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    # Create a new transcoding job
    new_job = TranscodingQueue(
        library_entry_id=library_entry_id,
        target_codec=req.target_codec
    )
    db.add(new_job)

    try:
        db.commit()
        db.refresh(new_job)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An active transcode job for this item already exists.")

    # Dispatch the Celery task
    transcode_video_task.delay(new_job.id)

    return {"message": "Transcoding job started", "job_id": new_job.id}

@router.get("/")
def get_transcode_jobs(status: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Retrieves all transcoding jobs, optionally filtered by status.
    """
    query = db.query(TranscodingQueue)
    if status:
        query = query.filter(TranscodingQueue.status == status)
    return query.all()

@router.delete("/{job_id}")
def delete_transcode_job(job_id: int, db: Session = Depends(get_db)):
    """
    Removes a transcoding job from the queue.
    """
    job = db.query(TranscodingQueue).filter(TranscodingQueue.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}