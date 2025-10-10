import os
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import SsoLink, User, Passkey
from routers.auth import get_current_user
from security import ALGORITHM, JWT_SECRET, create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/sso", tags=["sso"])

class SsoLinkRequest(BaseModel):
    provider: str = Field(..., description="Provider name: google, github, discord")
    provider_user_id: str = Field(..., min_length=1)
    email: Optional[str] = None
    token: Optional[str] = None

class SsoLoginRequest(BaseModel):
    provider: str = Field(..., description="Provider name: google, github, discord")
    provider_user_id: str = Field(..., min_length=1)
    token: Optional[str] = None

@router.get("/links", response_model=List[dict])
def list_sso_links(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    links = db.query(SsoLink).filter(SsoLink.user_id == current_user.id).order_by(SsoLink.linked_at.desc()).all()
    return [
        {
            "id": link.id,
            "provider": link.provider,
            "provider_user_id": link.provider_user_id,
            "email": link.email,
            "linked_at": link.linked_at
        }
        for link in links
    ]

@router.post("/link")
def link_sso(
    req: SsoLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req.provider = req.provider.lower().strip()
    if req.provider not in ("google", "github", "discord"):
        raise HTTPException(status_code=400, detail="Unsupported SSO provider.")
        
    # Check if this SSO provider/ID combination is already linked to ANOTHER user
    existing_link = db.query(SsoLink).filter(
        SsoLink.provider == req.provider,
        SsoLink.provider_user_id == req.provider_user_id
    ).first()
    
    if existing_link:
        if existing_link.user_id == current_user.id:
            return {"status": "success", "message": f"{req.provider.capitalize()} is already linked to this account."}
        raise HTTPException(status_code=400, detail="This SSO identity is already linked to another Voyarr account.")
        
    # Check if current user already has this provider linked
    user_existing = db.query(SsoLink).filter(
        SsoLink.user_id == current_user.id,
        SsoLink.provider == req.provider
    ).first()
    if user_existing:
        raise HTTPException(status_code=400, detail=f"Your account already has a linked {req.provider.capitalize()} account.")

    # Create link
    sso_link = SsoLink(
        user_id=current_user.id,
        provider=req.provider,
        provider_user_id=req.provider_user_id,
        email=req.email,
        linked_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(sso_link)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to link SSO: {e}")
        raise HTTPException(status_code=500, detail="Database save failed.")
        
    return {"status": "success", "message": f"{req.provider.capitalize()} linked successfully!"}

@router.post("/unlink/{provider}")
def unlink_sso(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = provider.lower().strip()
    sso_link = db.query(SsoLink).filter(
        SsoLink.user_id == current_user.id,
        SsoLink.provider == provider
    ).first()
    
    if not sso_link:
        raise HTTPException(status_code=404, detail=f"Linked {provider.capitalize()} account not found.")
        
    # Security Safeguard: Prevent lockouts if user has no password AND no other auth methods
    # Count other SSO links
    other_sso_count = db.query(SsoLink).filter(
        SsoLink.user_id == current_user.id,
        SsoLink.id != sso_link.id
    ).count()
    
    # Count passkeys
    passkeys_count = db.query(Passkey).filter(Passkey.user_id == current_user.id).count()
    
    # Check if they have a password
    has_password = bool(current_user.password_hash)
    
    if not has_password and other_sso_count == 0 and passkeys_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot unlink the last authentication method. Please set a password or add a passkey first to avoid locking your account."
        )
        
    db.delete(sso_link)
    db.commit()
    return {"status": "success", "message": f"{provider.capitalize()} unlinked successfully!"}

@router.post("/login")
def login_sso(
    req: SsoLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    req.provider = req.provider.lower().strip()
    sso_link = db.query(SsoLink).filter(
        SsoLink.provider == req.provider,
        SsoLink.provider_user_id == req.provider_user_id
    ).first()
    
    if not sso_link:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"This {req.provider.capitalize()} account is not linked to any Voyarr account."
        )
        
    user = db.query(User).filter(User.id == sso_link.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Associated user account not found.")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Associated user account is inactive.")
        
    # Generate access token
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    
    samesite = os.getenv("COOKIE_SAMESITE", "lax").lower()
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=samesite,
        secure=secure,
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }
