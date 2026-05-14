import os
from celery import Celery
from celery.schedules import crontab

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
        "tasks.transcode_tasks"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    'process-schedules-every-minute': {
        'task': 'tasks.schedule_tasks.process_schedules',
        'schedule': crontab(minute='*'),
    },
    'automated-daily-backup': {
        'task': 'tasks.backup_tasks.automated_backup',
        'schedule': crontab(hour=2, minute=0),
    },
    'cleanup-dangling-media': {
        'task': 'tasks.cleanup_tasks.cleanup_abandoned_media',
        'schedule': crontab(hour=3, minute=0),
    },
    'scan-for-duplicates': {
        'task': 'tasks.duplicate_tasks.scan_for_duplicates',
        'schedule': crontab(hour=4, minute=0),
    },
}