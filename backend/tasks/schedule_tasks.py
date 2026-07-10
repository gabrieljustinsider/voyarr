import os
import requests
from celery import shared_task  # type: ignore
from models import ScrapeSchedule
from datetime import datetime, timezone
from croniter import croniter
from db_utils import get_db_session
from celery_utils import single_instance_task
from typing import cast


@shared_task
@single_instance_task(timeout_seconds=55)
def process_schedules() -> None:
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
                        iter_cron = croniter(str(schedule.cron_expression), now)
                        schedule.next_run = iter_cron.get_next(datetime)  # type: ignore
                        schedule.last_run = now  # type: ignore
                    except Exception as cron_err:
                        schedule.is_active = False  # type: ignore
                        schedule.last_run_status = "error"  # type: ignore
                        schedule.last_run_details = f"Invalid cron expression, deactivated. Error: {cron_err}"  # type: ignore
                        db.commit()
                        continue

                    db.commit()

                    # Call the internal FastAPI mass_rip endpoint to ingest the target URL and run it against rules
                    if hasattr(schedule, "target_url") and schedule.target_url:  # type: ignore
                        response = requests.post(
                            f"{api_base}/download/mass_rip",
                            json={
                                "provider_id": int(cast(int, schedule.provider_id)),
                                "url": str(schedule.target_url),
                                "action": str(schedule.action),
                            },
                            headers={"X-Voyarr-Api-Key": api_key},
                            timeout=120,
                        )
                        response.raise_for_status()

                    schedule.last_run_status = "success"  # type: ignore
                    schedule.last_run_details = "Triggered successfully"  # type: ignore
                    db.commit()
                except Exception as e:
                    schedule.last_run_status = "error"  # type: ignore
                    schedule.last_run_details = str(e)  # type: ignore
                    db.commit()
                    print(f"Error executing schedule {schedule.id}: {str(e)}")
        except Exception as e:
            print(f"Schedule processor error: {str(e)}")


@shared_task
def auto_sync_credentials() -> None:
    with get_db_session() as db:
        try:
            from models import Settings

            interval_setting = (
                db.query(Settings)
                .filter(Settings.key == "pm_auto_sync_interval")
                .first()
            )
            direction_setting = (
                db.query(Settings).filter(Settings.key == "pm_sync_direction").first()
            )

            interval = str(interval_setting.value) if interval_setting and interval_setting.value is not None else "disabled"  # type: ignore
            direction = str(direction_setting.value) if direction_setting and direction_setting.value is not None else "pull"  # type: ignore

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

            from services.credential_base import CredentialServiceBase
            from services.onepassword_service import OnePasswordService
            from services.bitwarden_service import BitwardenService

            _reg: dict[str, type[CredentialServiceBase]] = {}
            OnePasswordService.register(_reg)
            BitwardenService.register(_reg)

            for name, svc in _reg.items():
                try:
                    getattr(svc, f"{direction}_credentials")(db)
                except Exception as e:
                    print(f"Auto-sync {name} skipped/failed: {e}")

        except Exception as e:
            print(f"Auto-sync error: {e}")
