from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from database import get_db
from models import ScrapeSchedule
from schemas import ScrapeScheduleCreate, ScrapeScheduleUpdate, ScrapeScheduleResponse
from croniter import croniter
from tasks.schedule_tasks import process_schedules

from dependencies import verify_api_key

def check_schedules_feature_permission(
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    from db_utils import check_feature_permission
    from models import User
    user = None
    if auth_info.get("type") == "jwt" and auth_info.get("user"):
        user = db.query(User).filter(User.username == auth_info.get("user")).first()
    check_feature_permission(db, "scraping", user)


router = APIRouter(
    prefix="/schedules",
    tags=["schedules"],
    dependencies=[Depends(verify_api_key), Depends(check_schedules_feature_permission)]
)


@router.get("/", response_model=List[ScrapeScheduleResponse])
def get_schedules(db: Session = Depends(get_db)):
    return db.query(ScrapeSchedule).all()


@router.post("/", response_model=ScrapeScheduleResponse)
def create_schedule(schedule: ScrapeScheduleCreate, db: Session = Depends(get_db)):
    if not croniter.is_valid(schedule.cron_expression):
        raise HTTPException(status_code=400, detail="Invalid cron expression")

    if hasattr(schedule, "model_dump"):
        db_schedule = ScrapeSchedule(**schedule.model_dump())
    else:
        db_schedule = ScrapeSchedule(**schedule.dict())

    # Calculate next run
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    iter = croniter(schedule.cron_expression, now)
    db_schedule.next_run = iter.get_next(datetime)

    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule


@router.put("/{schedule_id}", response_model=ScrapeScheduleResponse)
def update_schedule(
    schedule_id: int, schedule: ScrapeScheduleUpdate, db: Session = Depends(get_db)
):
    db_schedule = (
        db.query(ScrapeSchedule).filter(ScrapeSchedule.id == schedule_id).first()
    )
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if hasattr(schedule, "model_dump"):
        update_data = schedule.model_dump(exclude_unset=True)
    else:
        update_data = schedule.dict(exclude_unset=True)

    if "cron_expression" in update_data and not croniter.is_valid(
        update_data["cron_expression"]
    ):
        raise HTTPException(status_code=400, detail="Invalid cron expression")

    for key, value in update_data.items():
        setattr(db_schedule, key, value)

    if "cron_expression" in update_data or "is_active" in update_data:
        if db_schedule.is_active:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            iter = croniter(db_schedule.cron_expression, now)
            db_schedule.next_run = iter.get_next(datetime)
        else:
            db_schedule.next_run = None

    db.commit()
    db.refresh(db_schedule)
    return db_schedule


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = (
        db.query(ScrapeSchedule).filter(ScrapeSchedule.id == schedule_id).first()
    )
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    db.delete(db_schedule)
    db.commit()
    return {"message": "Schedule deleted successfully"}


@router.post("/{schedule_id}/trigger")
def trigger_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = (
        db.query(ScrapeSchedule).filter(ScrapeSchedule.id == schedule_id).first()
    )
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Force the next run to now so the task processor picks it up immediately
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_schedule.next_run = now
    db.commit()

    process_schedules.delay()
    return {"message": "Schedule queued for immediate execution"}
