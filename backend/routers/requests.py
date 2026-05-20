from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MediaRequest, DownloadQueue, MediaEntry
from pydantic import BaseModel
from typing import Optional
from dependencies import verify_api_key
from tasks.download_tasks import real_download_task

router = APIRouter(
    prefix="/requests", tags=["requests"], dependencies=[Depends(verify_api_key)]
)


class RequestCreate(BaseModel):
    title: str
    url: Optional[str] = None
    notes: Optional[str] = None
    requested_by: Optional[str] = None


class RequestUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def get_requests(db: Session = Depends(get_db)):
    return db.query(MediaRequest).order_by(MediaRequest.created_at.desc()).all()


@router.post("/")
def create_request(req: RequestCreate, db: Session = Depends(get_db)):
    db_req = MediaRequest(
        title=req.title, url=req.url, notes=req.notes, requested_by=req.requested_by
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


@router.put("/{req_id}")
def update_request(req_id: int, req: RequestUpdate, db: Session = Depends(get_db)):
    db_req = db.query(MediaRequest).filter(MediaRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")

    old_status = db_req.status
    if req.status is not None:
        db_req.status = req.status
    if req.notes is not None:
        db_req.notes = req.notes

    # If approved and has a URL, trigger download
    if req.status == "approved" and old_status != "approved" and db_req.url:
        # Note: In a real scenario, we might want to know which provider to use.
        # For now, we'll assume the first available provider or a default one.
        # This is a simplification.
        from models import Credential, SessionCookie
        from routers.download import check_limits_and_cookies
        
        # Hardcoding provider_id=1 for now as a fallback if not specified
        provider_id = 1 
        can_download, limit_result = check_limits_and_cookies(db, provider_id)
        
        # Create a skeleton MediaEntry
        media = MediaEntry(
            provider_id=provider_id,
            title=db_req.title,
            media_metadata={"requested_by": db_req.requested_by, "request_id": db_req.id},
        )
        db.add(media)
        db.flush()

        # Add to DownloadQueue
        queue_item = DownloadQueue(
            media_entry_id=media.id,
            url=db_req.url,
            status="pending" if can_download else "queued",
            progress_percentage=0.0,
        )
        db.add(queue_item)
        db.flush()

        if can_download:
            if isinstance(limit_result, SessionCookie):
                limit_result.downloads_used += 1
            
            credential = db.query(Credential).filter(Credential.provider_id == provider_id).first()
            if credential:
                credential.downloads_used += 1
            
            db.commit()
            db.refresh(queue_item)

            # Trigger Celery Task
            try:
                real_download_task.delay(queue_item.id, {}, {})
            except Exception as e:
                print(f"Failed to trigger download task: {e}")
        else:
            db.commit()
            db.refresh(queue_item)
    else:
        db.commit()

    db.refresh(db_req)
    return db_req


@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db)):
    db_req = db.query(MediaRequest).filter(MediaRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(db_req)
    db.commit()
    return {"message": "Request deleted"}
