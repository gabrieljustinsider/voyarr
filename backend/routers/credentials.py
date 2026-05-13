from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Credential, Vault
from schemas import CredentialCreate, CredentialResponse
from security import encrypt_data, decrypt_data

from dependencies import verify_api_key
router = APIRouter(prefix="/credentials", tags=["credentials"], dependencies=[Depends(verify_api_key)])

@router.post("", response_model=CredentialResponse)
async def create_credential(cred: CredentialCreate, db: Session = Depends(get_db)):
    try:
        new_cred = Credential(
            provider_id=cred.provider_id,
            custom_limits=cred.custom_limits
        )
        db.add(new_cred)
        db.flush() # To get new_cred.id
        
        # Store in Vault
        vault_user = Vault(
            entity_type='credential',
            entity_id=new_cred.id,
            key='username',
            encrypted_value=encrypt_data(cred.username)
        )
        vault_pass = Vault(
            entity_type='credential',
            entity_id=new_cred.id,
            key='password',
            encrypted_value=encrypt_data(cred.password)
        )
        db.add(vault_user)
        db.add(vault_pass)
        
        db.commit()
        db.refresh(new_cred)
        # The response model will automatically map from the new_cred object
        return new_cred
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save credential: {str(e)}")

@router.get("/{provider_id}")
async def get_credentials(provider_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credentials not found")
    
    vault_items = db.query(Vault).filter_by(entity_type='credential', entity_id=cred.id).all()
    vault_dict = {item.key: decrypt_data(item.encrypted_value) for item in vault_items}
    
    return {
        "provider_id": provider_id, 
        "username": vault_dict.get('username', ''), 
        "password": vault_dict.get('password', ''), 
        "custom_limits": cred.custom_limits
    }
