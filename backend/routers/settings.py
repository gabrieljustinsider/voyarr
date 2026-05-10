from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Settings
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingUpdate(BaseModel):
    key: str
    value: str | None = None

@router.get("")
async def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    return {setting.key: setting.value for setting in settings}

@router.post("")
async def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    db_setting = db.query(Settings).filter(Settings.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
    else:
        db_setting = Settings(key=setting.key, value=setting.value)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return {"message": "Setting updated"}

@router.delete("/{key}")
async def delete_setting(key: str, db: Session = Depends(get_db)):
    db_setting = db.query(Settings).filter(Settings.key == key).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(db_setting)
    db.commit()
    return {"message": "Setting deleted"}