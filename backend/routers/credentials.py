from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Credential
from schemas import CredentialCreate, CredentialResponse
from security import cipher

from dependencies import verify_api_key
router = APIRouter(prefix="/credentials", tags=["credentials"], dependencies=[Depends(verify_api_key)])

@router.post("", response_model=CredentialResponse)
async def create_credential(cred: CredentialCreate, db: Session = Depends(get_db)):
    if not cipher:
        raise HTTPException(status_code=500, detail="Encryption not configured")
    
    # Encrypt credentials
    encrypted_username = cipher.encrypt(cred.username.encode()).decode()
    encrypted_password = cipher.encrypt(cred.password.encode()).decode()
    
    try:
        new_cred = Credential(
            provider_id=cred.provider_id,
            username_encrypted=encrypted_username,
            password_encrypted=encrypted_password,
            custom_limits=cred.custom_limits
        )
        db.add(new_cred)
        db.commit()
        db.refresh(new_cred)
        return CredentialResponse(
            id=new_cred.id,
            provider_id=new_cred.provider_id,
            username=cred.username,  # Note: In production, don't return plain username
            custom_limits=new_cred.custom_limits,
            created_at=new_cred.created_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save credential: {str(e)}")

@router.get("/{provider_id}")
async def get_credentials(provider_id: int, db: Session = Depends(get_db)):
    if not cipher:
        raise HTTPException(status_code=500, detail="Encryption not configured")
    
    cred = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credentials not found")
    
    username = cipher.decrypt(cred.username_encrypted.encode()).decode()
    password = cipher.decrypt(cred.password_encrypted.encode()).decode()
    
    return {
        "provider_id": provider_id, 
        "username": username, 
        "password": password, 
        "custom_limits": cred.custom_limits
    }
