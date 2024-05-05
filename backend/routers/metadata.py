from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MetadataCache
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/metadata", tags=["metadata"])

class MetadataCreate(BaseModel):
    site_id: str
    provider: Optional[str] = None
    title: Optional[str] = None
    performers: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    raw_metadata: Optional[Dict[str, Any]] = None

@router.post("/")
def create_metadata(meta: MetadataCreate, db: Session = Depends(get_db)):
    db_meta = MetadataCache(**meta.dict())
    db.add(db_meta)
    db.commit()
    db.refresh(db_meta)
    return db_meta

@router.get("/")
def get_metadata(db: Session = Depends(get_db)):
    return db.query(MetadataCache).all()

@router.put("/{meta_id}")
def update_metadata(meta_id: int, meta: MetadataCreate, db: Session = Depends(get_db)):
    db_meta = db.query(MetadataCache).filter(MetadataCache.id == meta_id).first()
    if not db_meta:
        raise HTTPException(status_code=404, detail="Metadata not found")
    for key, value in meta.dict(exclude_unset=True).items():
        setattr(db_meta, key, value)
    db.commit()
    db.refresh(db_meta)
    return db_meta

@router.delete("/{meta_id}")
def delete_metadata(meta_id: int, db: Session = Depends(get_db)):
    db_meta = db.query(MetadataCache).filter(MetadataCache.id == meta_id).first()
    if db_meta:
        db.delete(db_meta)
        db.commit()
    return {"message": "Metadata deleted"}