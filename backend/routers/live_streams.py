from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import LiveStream, Vault, User
from routers.auth import get_current_user
from security import encrypt_data, decrypt_data
from pydantic import BaseModel
from typing import Optional
import subprocess # nosec B404
import os
import shutil

from utils import validate_url_ssrf

from dependencies import require_permission

router = APIRouter(
    prefix="/live-streams",
    tags=["live_streams"],
    dependencies=[Depends(require_permission("streaming", "view"))]
)

class LiveStreamCreateUpdate(BaseModel):
    name: str
    url: str
    auto_monitor: bool = False
    auto_record: bool = False

class LiveStreamAuth(BaseModel):
    cookies: Optional[str] = None
    headers: Optional[str] = None


@router.get("")
def list_live_streams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all monitored live streams."""
    streams = db.query(LiveStream).order_by(LiveStream.created_at.desc()).all()
    return streams


@router.get("/{stream_id}")
def get_live_stream(stream_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve details for a specific live stream."""
    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )
    return stream


@router.post("", status_code=status.HTTP_201_CREATED)
def create_live_stream(
    req: LiveStreamCreateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new live stream monitor config (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage live streams.",
        )

    if not req.url.lower().startswith(("http://", "https://", "rtmp://", "rtmps://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid stream URL scheme. Only HTTP, HTTPS, and RTMP are permitted."
        )

    if req.url.lower().startswith(("http://", "https://")):
        validate_url_ssrf(req.url)

    existing = db.query(LiveStream).filter(LiveStream.name.ilike(req.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A live stream config named '{req.name}' already exists."
        )

    stream = LiveStream(
        name=req.name,
        url=req.url,
        status="idle",
        auto_monitor=req.auto_monitor,
        auto_record=req.auto_record,
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


@router.put("/{stream_id}")
def update_live_stream(
    stream_id: int,
    req: LiveStreamCreateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing live stream monitor config (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage live streams.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    if not req.url.lower().startswith(("http://", "https://", "rtmp://", "rtmps://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid stream URL scheme. Only HTTP, HTTPS, and RTMP are permitted."
        )

    if req.url.lower().startswith(("http://", "https://")):
        validate_url_ssrf(req.url)

    stream.name = req.name
    stream.url = req.url
    db.commit()
    db.refresh(stream)
    return stream


@router.delete("/{stream_id}")
def delete_live_stream(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a live stream monitor config (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage live streams.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    # Prevent orphaning background tasks and subprocesses if deleted while active
    if stream.pid:
        try:
            import signal
            os.kill(stream.pid, signal.SIGKILL)
        except Exception:
            pass
            
    if stream.current_task_id:
        from celery_app import celery_app
        celery_app.control.revoke(stream.current_task_id, terminate=True, signal="SIGKILL")

    # Clean up any associated secure Vault settings
    db.query(Vault).filter_by(entity_type="live_stream_auth", entity_id=stream_id).delete()
    db.delete(stream)
    db.commit()
    return {"message": "Live stream monitor config deleted successfully."}


@router.get("/{stream_id}/auth")
def get_live_stream_auth(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if secure credentials exist for a live stream in the Vault (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized auth lookup.",
        )

    cookie_entry = db.query(Vault).filter_by(
        entity_type="live_stream_auth", entity_id=stream_id, key="cookies"
    ).first()
    header_entry = db.query(Vault).filter_by(
        entity_type="live_stream_auth", entity_id=stream_id, key="headers"
    ).first()

    return {
        "has_cookies": cookie_entry is not None,
        "has_headers": header_entry is not None
    }


@router.post("/{stream_id}/auth")
def save_live_stream_auth(
    stream_id: int,
    req: LiveStreamAuth,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Configure secure credentials (cookies, headers) for private live stream access (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can configure live stream authentication.",
        )

    # Ensure stream exists
    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    # Save cookies
    if req.cookies is not None:
        cookie_entry = db.query(Vault).filter_by(
            entity_type="live_stream_auth", entity_id=stream_id, key="cookies"
        ).first()
        if cookie_entry:
            if req.cookies.strip() == "":
                db.delete(cookie_entry)
            else:
                cookie_entry.encrypted_value = encrypt_data(req.cookies)
        elif req.cookies.strip() != "":
            cookie_entry = Vault(
                entity_type="live_stream_auth",
                entity_id=stream_id,
                key="cookies",
                encrypted_value=encrypt_data(req.cookies)
            )
            db.add(cookie_entry)

    # Save headers
    if req.headers is not None:
        header_entry = db.query(Vault).filter_by(
            entity_type="live_stream_auth", entity_id=stream_id, key="headers"
        ).first()
        if header_entry:
            if req.headers.strip() == "":
                db.delete(header_entry)
            else:
                header_entry.encrypted_value = encrypt_data(req.headers)
        elif req.headers.strip() != "":
            header_entry = Vault(
                entity_type="live_stream_auth",
                entity_id=stream_id,
                key="headers",
                encrypted_value=encrypt_data(req.headers)
            )
            db.add(header_entry)

    db.commit()
    return {"message": "Live stream credentials successfully saved in Vault."}


@router.post("/{stream_id}/record")
def record_live_stream(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start background live stream capturing task (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can record live streams.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    if stream.status == "recording":
        return {"status": "recording", "message": "Stream is already being recorded."}

    # Set status to trigger capture
    stream.status = "recording"
    stream.written_size = 0
    stream.elapsed_seconds = 0
    db.commit()

    # Import and queue the background Celery task
    from tasks.live_tasks import record_live_stream_task
    task = record_live_stream_task.delay(stream_id)

    stream.current_task_id = task.id
    db.commit()

    return {"status": "recording", "message": "Background recording task spawned successfully.", "task_id": task.id}


@router.post("/{stream_id}/stop")
def stop_live_stream_recording(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop the background live stream capturing task (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can stop live stream recordings.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    # Set status to idle - our recording task will check this and terminate
    stream.status = "idle"
    
    # 1. Kill active streamlink process
    if stream.pid:
        try:
            import signal
            os.kill(stream.pid, signal.SIGKILL)
        except Exception:
            pass
        stream.pid = None

    # 2. Revoke active Celery task
    if stream.current_task_id:
        from celery_app import celery_app
        celery_app.control.revoke(stream.current_task_id, terminate=True, signal="SIGKILL")
        stream.current_task_id = None
        
    db.commit()

    return {"status": "idle", "message": "Recording stop signal dispatched successfully."}


@router.post("/{stream_id}/pause")
def pause_live_stream_recording(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause background live stream recording (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can pause live stream recordings.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    if stream.status != "recording":
        raise HTTPException(status_code=400, detail="Only active recordings can be paused")

    stream.status = "paused"
    db.commit()

    if stream.pid:
        try:
            import signal
            os.kill(stream.pid, signal.SIGSTOP)
        except Exception as e:
            print(f"Failed to pause streamlink process {stream.pid}: {e}")

    return {"status": "paused", "message": "Recording paused successfully."}


@router.post("/{stream_id}/resume")
def resume_live_stream_recording(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resume background live stream recording (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can resume live stream recordings.",
        )

    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    if stream.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused recordings can be resumed")

    stream.status = "recording"
    db.commit()

    if stream.pid:
        try:
            import signal
            os.kill(stream.pid, signal.SIGCONT)
        except Exception as e:
            print(f"Failed to resume streamlink process {stream.pid}: {e}")

    return {"status": "recording", "message": "Recording resumed successfully."}


@router.get("/{stream_id}/stream")
def proxy_live_stream_url(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolves HLS proxy URLs using Vault credentials to support private/ticket playback in browser."""
    stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Live stream not found"
        )

    # Fetch cookies and headers from Vault if they exist
    cookie_entry = db.query(Vault).filter_by(
        entity_type="live_stream_auth", entity_id=stream_id, key="cookies"
    ).first()
    header_entry = db.query(Vault).filter_by(
        entity_type="live_stream_auth", entity_id=stream_id, key="headers"
    ).first()

    cmd = ["streamlink", "--stream-url", stream.url, "best"]

    # Append cookies and headers to command if they exist
    if cookie_entry and cookie_entry.encrypted_value:
        cookies_val = decrypt_data(cookie_entry.encrypted_value)
        if cookies_val:
            cmd.extend(["--http-cookie", cookies_val])

    if header_entry and header_entry.encrypted_value:
        headers_val = decrypt_data(header_entry.encrypted_value)
        if headers_val:
            # Format typically: HeaderName=HeaderValue
            for h in headers_val.split(";"):
                if "=" in h:
                    cmd.extend(["--http-header", h.strip()])

    # Check if streamlink is installed
    if not shutil.which("streamlink"):
        # Fall back directly to stream.url if streamlink is missing
        return {"stream_url": stream.url, "resolved": False}

    try:
        # Run streamlink command synchronously to fetch the HLS m3u8 playlist URL
        # B603 is suppressed as parameters are fully list-based and safe.
        res = subprocess.run( # nosec B603
            cmd,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=10
        )
        if res.returncode == 0:
            resolved_url = res.stdout.strip()
            if resolved_url.startswith("http"):
                return {"stream_url": resolved_url, "resolved": True}
        
        # If streamlink fails, fall back to the raw monitor url
        return {"stream_url": stream.url, "resolved": False, "error": res.stderr}
    except Exception as e:
        return {"stream_url": stream.url, "resolved": False, "error": str(e)}
