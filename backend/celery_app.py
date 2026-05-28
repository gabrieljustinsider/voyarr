import os
from typing import Any
from celery import Celery  # type: ignore
from celery.schedules import crontab  # type: ignore
from utils import initialize_network_settings
from celery.signals import task_prerun, worker_process_init  # type: ignore


@worker_process_init.connect  # type: ignore
def init_worker_network_settings(*args: Any, **kwargs: Any) -> None:
    try:
        initialize_network_settings()
    except Exception as e:
        print(f"Error initializing worker network settings: {e}")


@task_prerun.connect  # type: ignore
def on_task_prerun(
    sender: Any = None,
    task_id: Any = None,
    task: Any = None,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Ensure network configurations are fresh before executing any background task.
    """
    try:
        initialize_network_settings()
    except Exception as e:
        print(f"Error re-initializing network settings for task: {e}")


redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "voyarr",
    broker=redis_url,
    backend=redis_url,
    include=[
        "tasks.download_tasks",
        "tasks.schedule_tasks",
        "tasks.backup_tasks",
        "tasks.cleanup_tasks",
        "tasks.duplicate_tasks",
        "tasks.transcode_tasks",
        "tasks.ai_tasks",
        "tasks.scrape_tasks",
        "tasks.scanner_tasks",
        "tasks.ml_tasks",
        "tasks.sync_tasks",
        "tasks.live_tasks",
        "tasks.p2p_tasks",
    ],
)

celery_app.conf.update(  # type: ignore
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Distributed Worker Nodes support via Task Routing
    task_routes={
        "tasks.download_tasks.*": {"queue": "downloads"},
        "tasks.transcode_tasks.*": {"queue": "transcodes"},
        "tasks.scrape_tasks.*": {"queue": "scraping"},
        "tasks.ai_tasks.*": {"queue": "ai_inference"},
        "tasks.ml_tasks.*": {"queue": "ai_inference"},
        "*": {"queue": "celery"},  # Default queue
    },
)

celery_app.conf.beat_schedule = {  # type: ignore
    "process-schedules-every-minute": {
        "task": "tasks.schedule_tasks.process_schedules",
        "schedule": crontab(minute="*"),
    },
    "automated-daily-backup": {
        "task": "tasks.backup_tasks.automated_backup",
        "schedule": crontab(hour=2, minute=0),
    },
    "cleanup-dangling-media": {
        "task": "tasks.cleanup_tasks.cleanup_abandoned_media",
        "schedule": crontab(hour=3, minute=0),
    },
    "scan-for-duplicates": {
        "task": "tasks.duplicate_tasks.scan_for_duplicates",
        "schedule": crontab(hour=4, minute=0),
    },
    "auto-sync-credentials": {
        "task": "tasks.schedule_tasks.auto_sync_credentials",
        "schedule": crontab(minute=0),
    },
    "p2p-sync-scheduler": {
        "task": "tasks.p2p_tasks.p2p_sync_scheduler",
        "schedule": crontab(minute="*"),
    },
}
