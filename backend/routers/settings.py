from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Settings, Vault
from pydantic import BaseModel
import os
from typing import Optional, List

from dependencies import verify_api_key
from security import encrypt_data, decrypt_data
from rate_limiter import rate_limit

router = APIRouter(
    prefix="/settings", tags=["settings"], dependencies=[Depends(verify_api_key)]
)

SECURE_SETTINGS = [
    "tpdb_api_key",
    "stashdb_api_key",
    "extension_secret",
    "op_connect_token",
    "bw_session_token",
]


class SettingUpdate(BaseModel):
    key: str
    value: str | None = None


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    settings_dict = {setting.key: setting.value for setting in settings}

    # Load and seamlessly decrypt secure settings from the Vault
    vault_items = db.query(Vault).filter(Vault.entity_type == "global_setting").all()
    for item in vault_items:
        settings_dict[item.key] = decrypt_data(item.encrypted_value)

    return settings_dict


@router.post("", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    if setting.key in SECURE_SETTINGS:
        db_vault = (
            db.query(Vault)
            .filter(Vault.entity_type == "global_setting", Vault.key == setting.key)
            .first()
        )
        encrypted_val = encrypt_data(setting.value) if setting.value else ""

        if db_vault:
            db_vault.encrypted_value = encrypted_val
        else:
            db_vault = Vault(
                entity_type="global_setting",
                entity_id=0,
                key=setting.key,
                encrypted_value=encrypted_val,
            )
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
def delete_setting(key: str, db: Session = Depends(get_db)):
    if key in SECURE_SETTINGS:
        db_item = (
            db.query(Vault)
            .filter(Vault.entity_type == "global_setting", Vault.key == key)
            .first()
        )
    else:
        db_item = db.query(Settings).filter(Settings.key == key).first()

    if not db_item:
        raise HTTPException(status_code=404, detail="Setting not found")

    db.delete(db_item)
    db.commit()
    return {"message": "Setting deleted"}


@router.get("/browse")
def browse_directory(path: Optional[str] = Query(None)):
    target_path = path if path else "/"
    
    try:
        target_path = os.path.abspath(target_path)
    except Exception:
        target_path = "/"
        
    if not os.path.exists(target_path):
        target_path = "/"

    if not os.path.isdir(target_path):
        target_path = os.path.dirname(target_path)

    try:
        parent_path = os.path.dirname(target_path)
        if parent_path == target_path:
            parent_path = None

        folders = []
        files = []

        for item in os.listdir(target_path):
            if item.startswith("."):
                continue
            
            full_path = os.path.join(target_path, item)
            try:
                if os.path.isdir(full_path):
                    folders.append({
                        "name": item,
                        "path": full_path
                    })
                else:
                    files.append({
                        "name": item,
                        "path": full_path,
                        "size": os.path.getsize(full_path)
                    })
            except (PermissionError, FileNotFoundError):
                continue
        
        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())

        return {
            "current_path": target_path,
            "parent_path": parent_path,
            "folders": folders,
            "files": files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to browse directory: {str(e)}")


@router.get("/autocomplete")
def autocomplete_path(q: str = Query("")):
    if not q:
        q = "/"

    # Normalize path separators, keeping track if it is just a root or directory
    q_norm = os.path.normpath(q) if q != "/" else "/"
    ends_with_slash = q.endswith(os.sep) or q.endswith("/")
    
    if os.path.isdir(q_norm) and (ends_with_slash or q_norm == "/"):
        parent_dir = q_norm
        prefix = ""
    else:
        parent_dir = os.path.dirname(q_norm)
        prefix = os.path.basename(q_norm)

    if not os.path.exists(parent_dir) or not os.path.isdir(parent_dir):
        parent_dir = "/"
        prefix = ""

    suggestions = []
    try:
        for item in os.listdir(parent_dir):
            if item.startswith("."):
                continue
            
            if item.lower().startswith(prefix.lower()):
                full_path = os.path.join(parent_dir, item)
                try:
                    is_dir = os.path.isdir(full_path)
                    suggestions.append({
                        "name": item,
                        "path": full_path + ("/" if is_dir else ""),
                        "is_dir": is_dir
                    })
                except (PermissionError, FileNotFoundError):
                    continue
        
        suggestions.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {"suggestions": suggestions[:20]}
    except Exception:
        return {"suggestions": []}
