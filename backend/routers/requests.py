from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import requests as py_requests
import os

from database import get_db
from models import MediaRequest, User
from routers.auth import get_current_user
from routers.download import validate_url_ssrf

router = APIRouter(prefix="/requests", tags=["requests"])


class RequestCreate(BaseModel):
    title: str
    url: Optional[str] = None


@router.get("")
def list_requests(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """List all pending media requests (Visible to all authenticated users)."""
    return db.query(MediaRequest).order_by(MediaRequest.id.desc()).all()


@router.post("")
def create_request(
    req: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new media request from the web frontend."""
    if req.url:
        validate_url_ssrf(req.url)

    new_req = MediaRequest(
        title=req.title, url=req.url, requested_by=current_user.username
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req


@router.post("/{req_id}/approve")
def approve_request(
    req_id: int,
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin Only: Approve a request and send it to the download queue."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Forbidden: Only admins can approve requests"
        )

    db_req = db.query(MediaRequest).filter(MediaRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")

    if not db_req.url:
        raise HTTPException(
            status_code=400, detail="Cannot auto-approve a request without a URL."
        )

    validate_url_ssrf(db_req.url)

    # Route the approved request directly into the mass rip/download engine
    api_base = os.getenv(
        "INTERNAL_API_URL", f"http://backend:{os.getenv('PORT', '8000')}"
    )
    api_key = os.getenv("MASTER_KEY", "")

    try:
        response = py_requests.post(
            f"{api_base}/download/mass_rip",
            json={
                "provider_id": provider_id,
                "url": db_req.url,
                "action": "metadata_and_download",
            },
            headers={"X-Voyarr-Api-Key": api_key},
            timeout=10,
        )
        response.raise_for_status()
    except py_requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with internal download engine: {str(e)}",
        )

    db.delete(db_req)
    db.commit()
    return {"message": f"Request '{db_req.title}' approved and queued for download."}


@router.delete("/{req_id}")
def reject_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin Only: Reject and delete a request."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Forbidden: Only admins can reject requests"
        )

    db_req = db.query(MediaRequest).filter(MediaRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")

    db.delete(db_req)
    db.commit()
    return {"message": "Request deleted successfully"}
