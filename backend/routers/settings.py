from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Settings, Vault
from pydantic import BaseModel
import os

from dependencies import verify_api_key
from security import encrypt_data, decrypt_data
from rate_limiter import rate_limit

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(verify_api_key)])

SECURE_SETTINGS = ["tpdb_api_key", "stashdb_api_key", "extension_secret", "op_connect_token", "bw_session_token"]

class SettingUpdate(BaseModel):
    key: str
    value: str | None = None

@router.get("")
async def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    settings_dict = {setting.key: setting.value for setting in settings}
    
    # Load and seamlessly decrypt secure settings from the Vault
    vault_items = db.query(Vault).filter(Vault.entity_type == 'global_setting').all()
    for item in vault_items:
        settings_dict[item.key] = decrypt_data(item.encrypted_value)
        
    return settings_dict

@router.post("", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
async def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    if setting.key in SECURE_SETTINGS:
        db_vault = db.query(Vault).filter(Vault.entity_type == 'global_setting', Vault.key == setting.key).first()
        encrypted_val = encrypt_data(setting.value) if setting.value else ""
        
        if db_vault:
            db_vault.encrypted_value = encrypted_val
        else:
            db_vault = Vault(entity_type='global_setting', entity_id=0, key=setting.key, encrypted_value=encrypted_val)
            db.add(db_vault)
            
        # Clean up the old plain-text setting if it was previously saved during an older version
        db.query(Settings).filter(Settings.key == setting.key).delete()
    else:
        db_setting = db.query(Settings).filter(Settings.key == setting.key).first()
        if db_setting:
            db_setting.value = setting.value
        else:
            db_setting = Settings(key=setting.key, value=setting.value)
            db.add(db_setting)
            
    db.commit()
    return {"message": "Setting updated"}

@router.delete("/{key}")
async def delete_setting(key: str, db: Session = Depends(get_db)):
    if key in SECURE_SETTINGS:
        db_item = db.query(Vault).filter(Vault.entity_type == 'global_setting', Vault.key == key).first()
    else:
        db_item = db.query(Settings).filter(Settings.key == key).first()
        
    if not db_item:
        raise HTTPException(status_code=404, detail="Setting not found")
        
    db.delete(db_item)
    db.commit()
    return {"message": "Setting deleted"}