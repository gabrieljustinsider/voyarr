from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Settings, Vault
from pydantic import BaseModel
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from dependencies import verify_api_key
router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(verify_api_key)])

SECURE_SETTINGS = ["tpdb_api_key", "stashdb_api_key", "extension_secret"]

def encrypt_value(value: str) -> str:
    if not value: return ""
    master_key = os.getenv("MASTER_KEY")
    if not master_key: return value
    aesgcm = AESGCM(bytes.fromhex(master_key))
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, value.encode('utf-8'), None)
    return base64.b64encode(nonce + ct).decode('utf-8')

def decrypt_value(encrypted_b64: str) -> str:
    if not encrypted_b64: return ""
    master_key = os.getenv("MASTER_KEY")
    if not master_key: return encrypted_b64
    try:
        aesgcm = AESGCM(bytes.fromhex(master_key))
        data = base64.b64decode(encrypted_b64)
        nonce, ct = data[:12], data[12:]
        return aesgcm.decrypt(nonce, ct, None).decode('utf-8')
    except Exception:
        return ""

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
        settings_dict[item.key] = decrypt_value(item.encrypted_value)
        
    return settings_dict

@router.post("")
async def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    if setting.key in SECURE_SETTINGS:
        db_vault = db.query(Vault).filter(Vault.entity_type == 'global_setting', Vault.key == setting.key).first()
        encrypted_val = encrypt_value(setting.value) if setting.value else ""
        
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