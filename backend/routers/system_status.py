from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import shutil
import platform
import sys
from datetime import datetime, timezone
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
    now = datetime.now().astimezone()
    
    container_type = None
    if os.path.exists("/.dockerenv"):
        container_type = "Docker"
    elif os.path.exists("/run/.containerenv"):
        container_type = "Podman"
    else:
        try:
            with open("/proc/1/cgroup", "rt") as f:
                content = f.read()
                if "docker" in content:
                    container_type = "Docker"
                elif "kubepods" in content or "k8s" in content:
                    container_type = "Kubernetes"
                elif "podman" in content:
                    container_type = "Podman"
        except Exception:
            pass
            
    if not container_type and os.environ.get("KUBERNETES_SERVICE_HOST"):
        container_type = "Kubernetes"
        
    is_container = container_type is not None or os.path.exists("/.dockerenv")
    if is_container and not container_type:
        container_type = "Generic Container"

    from utils import get_version
    env_details = {
        "os": platform.system(),
        "release": platform.release(),
        "python_version": sys.version.split()[0],
        "app_version": get_version(),
        "docker_runtime": os.path.exists("/.dockerenv"),
        "is_docker": os.path.exists("/.dockerenv"),
        "is_container": is_container,
        "container_type": container_type,
        "time": {
            "utc": datetime.now(timezone.utc).isoformat(),
            "local": now.isoformat(),
            "timezone": now.tzname() or "UTC"
        },
        "system_time": {
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timezone": now.tzname() or "UTC"
        },
        "media_storage_disk": {},
        "app_disk": {}
    }
    
    # Legacy single fields for safety
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

    # Discover all storage devices/mounts
    disks = []
    if os.path.exists("/proc/mounts"):
        try:
            with open("/proc/mounts", "r") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        device, mountpoint = parts[0], parts[1]
                        if device.startswith("/dev/") or mountpoint in ("/app", "/media/storage", "/"):
                            if mountpoint.startswith(("/proc", "/sys", "/dev", "/run")):
                                continue
                            try:
                                total, used, free = shutil.disk_usage(mountpoint)
                                disks.append({
                                    "device": device,
                                    "mountpoint": mountpoint,
                                    "total_gb": round(total / (1024**3), 2),
                                    "used_gb": round(used / (1024**3), 2),
                                    "free_gb": round(free / (1024**3), 2),
                                    "percent_used": round((used / total) * 100, 2)
                                })
                            except Exception:
                                pass
        except Exception:
            pass

    for p in ["/", "/app", "/media/storage"]:
        if os.path.exists(p) and not any(d["mountpoint"] == p for d in disks):
            try:
                total, used, free = shutil.disk_usage(p)
                if not any(d["total_gb"] == round(total / (1024**3), 2) for d in disks):
                    disks.append({
                        "device": "overlay" if p == "/" else p,
                        "mountpoint": p,
                        "total_gb": round(total / (1024**3), 2),
                        "used_gb": round(used / (1024**3), 2),
                        "free_gb": round(free / (1024**3), 2),
                        "percent_used": round((used / total) * 100, 2)
                    })
            except Exception:
                pass

    env_details["disks"] = disks

    # Version Sync Check
    backend_ver = get_version()
    # We query package.json if running in dev, otherwise fallback to version file
    frontend_ver = None
    try:
        if os.path.exists("frontend/package.json"):
            import json
            with open("frontend/package.json", "r") as f:
                frontend_ver = json.load(f).get("version")
        elif os.path.exists("../frontend/package.json"):
            import json
            with open("../frontend/package.json", "r") as f:
                frontend_ver = json.load(f).get("version")
    except Exception:
        pass
    if not frontend_ver:
        # Check VERSION file at root if packages not found directly
        try:
            if os.path.exists("../VERSION"):
                with open("../VERSION", "r") as f:
                    frontend_ver = f.read().strip()
            elif os.path.exists("VERSION"):
                with open("VERSION", "r") as f:
                    frontend_ver = f.read().strip()
        except Exception:
            pass

    # Ensure defaults fallback cleanly
    frontend_ver = frontend_ver or backend_ver

    # Check celery worker version sync
    worker_ver = None
    if celery_status == "healthy" and celery_details.get("active_workers"):
        # Worker matches backend code by default if on same compose,
        # but in multi-server setups it could be mismatched.
        # Fallback to backend_ver if no explicit worker override version is sent.
        worker_ver = backend_ver 

    versions_synced = (backend_ver == frontend_ver)
    version_warnings = []
    if not versions_synced:
        version_warnings.append(
            f"Version mismatch detected: Frontend is at v{frontend_ver} but Backend is at v{backend_ver}. "
            "Please rebuild your frontend or pull the latest container images to ensure system stability."
        )

    return {
        "database": {"status": db_status, "details": db_details},
        "redis": {"status": redis_status, "details": redis_details},
        "celery": {"status": celery_status, "details": celery_details},
        "browserless": {"status": browserless_status, "details": browserless_details},
        "environment": env_details,
        "config": {
            "frontend": {"target": os.getenv("FRONTEND_TARGET", "docker")},
            "backend_api": {"target": os.getenv("BACKEND_API_TARGET", "docker")},
            "workers": {"target": os.getenv("WORKERS_TARGET", "docker")},
            "database": {"target": os.getenv("DATABASE_TARGET", "docker")},
            "scraper": {"target": os.getenv("SCRAPER_BROWSER_TARGET", "browserless-io")},
        },
        "version_check": {
            "synced": versions_synced,
            "frontend_version": frontend_ver,
            "backend_version": backend_ver,
            "worker_version": worker_ver,
            "warnings": version_warnings
        }
    }
