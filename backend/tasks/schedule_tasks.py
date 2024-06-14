import os
import requests
from celery import shared_task
from database import SessionLocal
from models import ScrapeSchedule
from datetime import datetime
from croniter import croniter

@shared_task
def process_schedules():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Find active schedules that are past their due date
        schedules = db.query(ScrapeSchedule).filter(
            ScrapeSchedule.is_active == True,
            ScrapeSchedule.next_run <= now
        ).all()

        api_port = os.getenv("PORT", "8000")
        api_key = os.getenv("MASTER_KEY", "")

        for schedule in schedules:
            try:
                print(f"Triggering automated schedule: '{schedule.name}' (Provider: {schedule.provider_id})")
                
                # Call the internal FastAPI mass_rip endpoint to ingest the target URL and run it against rules
                if hasattr(schedule, 'target_url') and schedule.target_url:
                    requests.post(
                        f"http://backend:{api_port}/download/mass_rip",
                        json={"provider_id": schedule.provider_id, "url": schedule.target_url},
                        headers={"X-Voyarr-Api-Key": api_key},
                        timeout=10
                    )

                # Calculate and save the next run cycle
                iter_cron = croniter(schedule.cron_expression, now)
                schedule.next_run = iter_cron.get_next(datetime)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Error executing schedule {schedule.id}: {str(e)}")
    except Exception as e:
        print(f"Schedule processor error: {str(e)}")
    finally:
        db.close()