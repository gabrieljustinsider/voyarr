from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MediaRequest
from pydantic import BaseModel
from typing import Optional
from dependencies import verify_api_key

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

    if req.status is not None:
        db_req.status = req.status
    if req.notes is not None:
        db_req.notes = req.notes

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
