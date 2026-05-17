import os
import requests
from celery import shared_task
from models import ScrapeSchedule
from datetime import datetime, timezone
from croniter import croniter
from db_utils import get_db_session


@shared_task
def process_schedules():
    with get_db_session() as db:
        try:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            # Find active schedules that are past their due date
            schedules = (
                db.query(ScrapeSchedule)
                .filter(ScrapeSchedule.is_active, ScrapeSchedule.next_run <= now)
                .all()
            )

            api_base = os.getenv(
                "INTERNAL_API_URL", f"http://backend:{os.getenv('PORT', '8000')}"
            )
            api_key = os.getenv("MASTER_KEY", "")

            for schedule in schedules:
                try:
                    print(
                        f"Triggering automated schedule: '{schedule.name}' (Provider: {schedule.provider_id})"
                    )

                    # Calculate and save the next run cycle BEFORE execution to prevent infinite loops on failure
                    try:
                        iter_cron = croniter(schedule.cron_expression, now)
                        schedule.next_run = iter_cron.get_next(datetime)
                        schedule.last_run = now
                    except Exception as cron_err:
                        schedule.is_active = False
                        schedule.last_run_status = "error"
                        schedule.last_run_details = (
                            f"Invalid cron expression, deactivated. Error: {cron_err}"
                        )
                        db.commit()
                        continue

                    db.commit()

                    # Call the internal FastAPI mass_rip endpoint to ingest the target URL and run it against rules
                    if hasattr(schedule, "target_url") and schedule.target_url:
                        response = requests.post(
                            f"{api_base}/download/mass_rip",
                            json={
                                "provider_id": schedule.provider_id,
                                "url": schedule.target_url,
                                "action": schedule.action,
                            },
                            headers={"X-Voyarr-Api-Key": api_key},
                            timeout=120,
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


@shared_task
def auto_sync_credentials():
    with get_db_session() as db:
        try:
            from models import Settings

            interval_setting = (
                db.query(Settings).filter(Settings.key == "pm_auto_sync_interval").first()
            )
            direction_setting = (
                db.query(Settings).filter(Settings.key == "pm_sync_direction").first()
            )

            interval = interval_setting.value if interval_setting else "disabled"
            direction = direction_setting.value if direction_setting else "pull"

            if direction not in ["pull", "push"]:
                direction = "pull"

            if interval == "disabled":
                return

            now = datetime.now(timezone.utc)
            if interval == "daily" and now.hour != 0:
                return
            if interval == "weekly" and (now.weekday() != 0 or now.hour != 0):
                return

            print(f"Running automated credential sync ({direction})...")

            from services.onepassword_service import OnePasswordService

            try:
                getattr(OnePasswordService, f"{direction}_credentials")(db)
            except Exception as e:
                print(f"Auto-sync 1Password skipped/failed: {e}")

            from services.bitwarden_service import BitwardenService

            try:
                getattr(BitwardenService, f"{direction}_credentials")(db)
            except Exception as e:
                print(f"Auto-sync Bitwarden skipped/failed: {e}")

        except Exception as e:
            print(f"Auto-sync error: {e}")
