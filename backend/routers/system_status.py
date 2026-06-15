from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import shutil
import platform
import sys
from database import get_db, engine
from dependencies import verify_api_key
from rate_limiter import redis_client

router = APIRouter(
    prefix="/system", tags=["system"], dependencies=[Depends(verify_api_key)]
)

@router.get("/status")
async def get_system_status(db: Session = Depends(get_db)):
    # 1. Database check
    db_status = "unknown"
    db_details = {}
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
        db_details = {
            "dialect": engine.name,
            "url": os.getenv("DATABASE_URL", "postgresql://voyarr_user:***@db:5432/voyarr").split("@")[-1]
        }
    except Exception:
        db_status = "unhealthy"
        db_details = {"error": "Database connection failed"}

    # 2. Redis check
    redis_status = "unknown"
    redis_details = {}
    try:
        await redis_client.ping()
        redis_status = "healthy"
        redis_details = {
            "url": os.getenv("REDIS_URL", "redis://redis:6379/0").split("@")[-1]
        }
    except Exception:
        redis_status = "unhealthy"
        redis_details = {"error": "Redis connection failed"}

    # 3. Celery check
    celery_status = "unknown"
    celery_details = {}
    try:
        from celery_app import celery_app
        inspect = celery_app.control.inspect(timeout=1.0)
        pings = inspect.ping()
        if pings:
            celery_status = "healthy"
            celery_details = {
                "active_workers": list(pings.keys()),
                "stats": inspect.stats() or {},
                "registered_tasks": inspect.registered() or {}
            }
        else:
            celery_status = "unhealthy"
            celery_details = {"info": "No active workers detected"}
    except Exception:
        celery_status = "unhealthy"
        celery_details = {"error": "Celery connection failed"}

    # 4. Browserless check
    browserless_status = "unknown"
    browserless_details = {}
    try:
        url = os.getenv("BROWSERLESS_URL", "wss://chrome.browserless.io")
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        hostname = (parsed.hostname or "").lower()
        is_cloud = hostname == "browserless.io" or hostname.endswith(".browserless.io")
        browserless_details = {
            "url": url,
            "type": "Cloud (Hosted)" if is_cloud else "Local (Docker)"
        }
        # Attempt a TCP connection check
        host = parsed.hostname or "chrome.browserless.io"
        port = parsed.port or (443 if parsed.scheme in ("wss", "https") else 80)
        import socket
        socket.setdefaulttimeout(2.0)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((host, port))
        s.close()
        browserless_status = "healthy"
    except Exception:
        browserless_status = "unhealthy"
        browserless_details["error"] = "Browserless connection failed"

    # 5. Disk space details
    now = datetime.datetime.now().astimezone()
    env_details = {
        "os": platform.system(),
        "release": platform.release(),
        "python_version": sys.version.split()[0],
        "docker_runtime": os.path.exists("/.dockerenv"),
        "time": {
            "utc": datetime.datetime.now(timezone.utc).isoformat(),
            "local": now.isoformat(),
            "timezone": now.tzname() or "UTC"
        },
        "media_storage_disk": {},
        "app_disk": {}
    }
    
    try:
        total, used, free = shutil.disk_usage("/media/storage")
        env_details["media_storage_disk"] = {
            "total_gb": round(total / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "percent_used": round((used / total) * 100, 2)
        }
    except Exception:
        pass

    try:
        total, used, free = shutil.disk_usage("/app")
        env_details["app_disk"] = {
            "total_gb": round(total / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "percent_used": round((used / total) * 100, 2)
        }
    except Exception:
        pass

    return {
        "database": {"status": db_status, "details": db_details},
        "redis": {"status": redis_status, "details": redis_details},
        "celery": {"status": celery_status, "details": celery_details},
        "browserless": {"status": browserless_status, "details": browserless_details},
        "environment": env_details
    }
