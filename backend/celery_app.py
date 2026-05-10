import os
from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure environment variables are loaded
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "voyarr",
    broker=redis_url,
    backend=redis_url,
    include=["tasks.download_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Shared DB Session helper for tasks
def get_task_db():
    database_url = os.getenv(
        "DATABASE_URL", 
        "postgresql://voyarr_user:voyarr_password@db:5432/voyarr"
    )
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()
