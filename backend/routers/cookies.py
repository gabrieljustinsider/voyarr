from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SessionCookie, Provider
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from services.cookie_service import CookieService

from dependencies import verify_api_key
router = APIRouter(prefix="/cookies", tags=["cookies"], dependencies=[Depends(verify_api_key)])

class CookieCreate(BaseModel):
    provider_id: Optional[int] = None
    site_id: Optional[str] = None
    cookie_data: str
    download_limit: Optional[int] = None
    duration_limit_seconds: Optional[int] = None

@router.post("/")
def create_cookie(cookie: CookieCreate, db: Session = Depends(get_db)):
    detected_limits = CookieService.auto_detect_limitations(cookie.cookie_data)
    
    db_cookie = SessionCookie(**cookie.dict())
    
    # Apply auto-detected expiration if not explicitly provided
    if 'expires_at' in detected_limits and not db_cookie.expires_at:
        db_cookie.expires_at = detected_limits['expires_at']
        
    db.add(db_cookie)
    db.commit()
    db.refresh(db_cookie)
    return db_cookie

@router.get("/")
def get_cookies(db: Session = Depends(get_db)):
    return db.query(SessionCookie).all()

@router.post("/{cookie_id}/test")
def test_cookie(cookie_id: int, db: Session = Depends(get_db)):
    cookie = db.query(SessionCookie).filter(SessionCookie.id == cookie_id).first()
    if not cookie:
        raise HTTPException(status_code=404, detail="Cookie not found")
    
    test_url = "https://example.com"
    if cookie.provider_id:
        provider = db.query(Provider).filter(Provider.id == cookie.provider_id).first()
        if provider:
            test_url = provider.base_url
            
    is_valid = CookieService.test_cookie_validity(cookie.cookie_data, test_url)
    
    cookie.status = 'active' if is_valid else 'invalid'
    db.commit()
    return {"status": cookie.status, "message": "Cookie tested successfully" if is_valid else "Cookie is invalid"}

@router.delete("/{cookie_id}")
def delete_cookie(cookie_id: int, db: Session = Depends(get_db)):
    cookie = db.query(SessionCookie).filter(SessionCookie.id == cookie_id).first()
    if not cookie:
        raise HTTPException(status_code=404, detail="Cookie not found")
    db.delete(cookie)
    db.commit()
    return {"message": "Cookie deleted"}