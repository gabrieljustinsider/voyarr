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
                
                # Calculate and save the next run cycle BEFORE execution to prevent infinite loops on failure
                try:
                    iter_cron = croniter(schedule.cron_expression, now)
                    schedule.next_run = iter_cron.get_next(datetime)
                    schedule.last_run = now
                except Exception as cron_err:
                    schedule.is_active = False
                    schedule.last_run_status = "error"
                    schedule.last_run_details = f"Invalid cron expression, deactivated. Error: {cron_err}"
                    db.commit()
                    continue

                db.commit()

                # Call the internal FastAPI mass_rip endpoint to ingest the target URL and run it against rules
                if hasattr(schedule, 'target_url') and schedule.target_url:
                    response = requests.post(
                        f"http://backend:{api_port}/download/mass_rip",
                        json={"provider_id": schedule.provider_id, "url": schedule.target_url},
                        headers={"X-Voyarr-Api-Key": api_key},
                        timeout=10
                    )
                    response.raise_for_status()

                schedule.last_run_status = "success"
                schedule.last_run_details = "Triggered successfully"
                db.commit()
            except Exception as e:
                schedule.last_run_status = "error"
                schedule.last_run_details = str(e)
                db.commit()
                print(f"Error executing schedule {schedule.id}: {str(e)}")
    except Exception as e:
        print(f"Schedule processor error: {str(e)}")
    finally:
        db.close()