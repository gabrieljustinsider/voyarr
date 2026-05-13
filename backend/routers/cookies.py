from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SessionCookie, Vault
from schemas import CookieCreate, CookieResponse
from security import encrypt_data
from services.cookie_service import CookieService
from dependencies import verify_api_key

router = APIRouter(prefix="/cookies", tags=["cookies"], dependencies=[Depends(verify_api_key)])

@router.get("", response_model=list[CookieResponse])
def get_cookies(db: Session = Depends(get_db)):
    return db.query(SessionCookie).all()

@router.post("", response_model=CookieResponse)
def create_cookie(req: CookieCreate, db: Session = Depends(get_db)):
    limits = CookieService.auto_detect_limitations(req.cookie_text)
    
    new_cookie = SessionCookie(
        provider_id=req.provider_id,
        download_limit=req.download_limit,
        expires_at=limits.get('expires_at')
    )
    db.add(new_cookie)
    db.flush()
    
    vault_entry = Vault(
        entity_type='session_cookie',
        entity_id=new_cookie.id,
        key='cookie_text',
        encrypted_value=encrypt_data(req.cookie_text)
    )
    db.add(vault_entry)
    db.commit()
    db.refresh(new_cookie)
    return new_cookie

@router.delete("/{cookie_id}")
def delete_cookie(cookie_id: int, db: Session = Depends(get_db)):
    cookie = db.query(SessionCookie).filter(SessionCookie.id == cookie_id).first()
    if not cookie:
        raise HTTPException(status_code=404, detail="Cookie not found")
        
    db.query(Vault).filter_by(entity_type='session_cookie', entity_id=cookie_id).delete()
    db.delete(cookie)
    db.commit()
    return {"message": "Cookie deleted successfully"}