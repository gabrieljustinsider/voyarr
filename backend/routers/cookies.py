from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SessionCookie, Provider
from pydantic import BaseModel
from typing import Optional

from dependencies import verify_api_key

router = APIRouter(prefix="/cookies", tags=["cookies"], dependencies=[Depends(verify_api_key)])

class CookieCreate(BaseModel):
    provider_id: int
    cookie_text: str
    download_limit: Optional[int] = None

@router.get("/")
def get_cookies(db: Session = Depends(get_db)):
    return db.query(SessionCookie).all()

@router.post("/")
def create_cookie(cookie: CookieCreate, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(Provider.id == cookie.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    new_cookie = SessionCookie(
        provider_id=cookie.provider_id,
        cookie_text=cookie.cookie_text,
        download_limit=cookie.download_limit,
        downloads_used=0,
        status='active'
    )
    db.add(new_cookie)
    db.commit()
    db.refresh(new_cookie)
    return new_cookie

@router.delete("/{cookie_id}")
def delete_cookie(cookie_id: int, db: Session = Depends(get_db)):
    cookie = db.query(SessionCookie).filter(SessionCookie.id == cookie_id).first()
    if not cookie:
        raise HTTPException(status_code=404, detail="Cookie not found")
    db.delete(cookie)
    db.commit()
    return {"message": "Cookie deleted"}