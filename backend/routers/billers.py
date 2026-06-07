from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Biller
from schemas import BillerResponse, BillerCreate, BillerUpdate
from dependencies import verify_api_key

router = APIRouter(
    prefix="/billers", tags=["billers"], dependencies=[Depends(verify_api_key)]
)

@router.get("", response_model=List[BillerResponse])
def get_billers(db: Session = Depends(get_db)):
    return db.query(Biller).all()

@router.post("", response_model=BillerResponse)
def create_biller(biller: BillerCreate, db: Session = Depends(get_db)):
    existing = db.query(Biller).filter(Biller.name == biller.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Biller with this name already exists")
    
    db_biller = Biller(**biller.model_dump())
    db.add(db_biller)
    db.commit()
    db.refresh(db_biller)
    return db_biller

@router.put("/{biller_id}", response_model=BillerResponse)
def update_biller(biller_id: int, biller: BillerUpdate, db: Session = Depends(get_db)):
    db_biller = db.query(Biller).filter(Biller.id == biller_id).first()
    if not db_biller:
        raise HTTPException(status_code=404, detail="Biller not found")
    
    for key, value in biller.model_dump(exclude_unset=True).items():
        setattr(db_biller, key, value)
    
    db.commit()
    db.refresh(db_biller)
    return db_biller

@router.delete("/{biller_id}")
def delete_biller(biller_id: int, db: Session = Depends(get_db)):
    db_biller = db.query(Biller).filter(Biller.id == biller_id).first()
    if not db_biller:
        raise HTTPException(status_code=404, detail="Biller not found")
    
    db.delete(db_biller)
    db.commit()
    return {"message": "Biller deleted successfully"}