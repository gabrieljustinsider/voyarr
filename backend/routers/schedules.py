from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
from models import ScrapeSchedule
from schemas import ScrapeScheduleCreate, ScrapeScheduleUpdate, ScrapeScheduleResponse
from croniter import croniter

from dependencies import verify_api_key

router = APIRouter(prefix="/schedules", tags=["schedules"], dependencies=[Depends(verify_api_key)])

@router.get("/", response_model=List[ScrapeScheduleResponse])
def get_schedules(db: Session = Depends(get_db)):
    return db.query(ScrapeSchedule).all()

@router.post("/", response_model=ScrapeScheduleResponse)
def create_schedule(schedule: ScrapeScheduleCreate, db: Session = Depends(get_db)):
    if not croniter.is_valid(schedule.cron_expression):
        raise HTTPException(status_code=400, detail="Invalid cron expression")
        
    db_schedule = ScrapeSchedule(**schedule.dict())
    
    # Calculate next run
    now = datetime.utcnow()
    iter = croniter(schedule.cron_expression, now)
    db_schedule.next_run = iter.get_next(datetime)
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@router.put("/{schedule_id}", response_model=ScrapeScheduleResponse)
def update_schedule(schedule_id: int, schedule: ScrapeScheduleUpdate, db: Session = Depends(get_db)):
    db_schedule = db.query(ScrapeSchedule).filter(ScrapeSchedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    update_data = schedule.dict(exclude_unset=True)
    if 'cron_expression' in update_data and not croniter.is_valid(update_data['cron_expression']):
        raise HTTPException(status_code=400, detail="Invalid cron expression")
        
    for key, value in update_data.items():
        setattr(db_schedule, key, value)
        
    if 'cron_expression' in update_data or 'is_active' in update_data:
        if db_schedule.is_active:
            now = datetime.utcnow()
            iter = croniter(db_schedule.cron_expression, now)
            db_schedule.next_run = iter.get_next(datetime)
        else:
            db_schedule.next_run = None
            
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(ScrapeSchedule).filter(ScrapeSchedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    db.delete(db_schedule)
    db.commit()
    return {"message": "Schedule deleted successfully"}
