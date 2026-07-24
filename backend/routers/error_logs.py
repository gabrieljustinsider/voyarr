from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from models import ErrorLog, Settings, User
from dependencies import verify_api_key
from routers.auth import get_current_user
from error_classifier import classify_error, prune_error_logs
from pydantic import BaseModel

router = APIRouter(prefix="/logs/errors", tags=["error_logs"])

class LogErrorRequest(BaseModel):
    message: str
    stack_trace: Optional[str] = ""
    source: Optional[str] = "frontend"
    path: Optional[str] = ""
    status_code: Optional[int] = 500

class ErrorLogSettingsRequest(BaseModel):
    max_entries: int  # 0 for unlimited, or e.g. 100, 500, 1000
    max_days: int     # 0 for unlimited, or e.g. 1, 7, 30

@router.post("")
@router.post("/")
def log_error(req: LogErrorRequest, db: Session = Depends(get_db)):
    """Log an error from frontend or backend with automatic classification and auto-pruning."""
    classification = classify_error(req.message, req.stack_trace or "", req.status_code or 500)
    
    error_entry = ErrorLog(
        category=classification["category"],
        category_label=classification["category_label"],
        message=req.message,
        user_friendly_explanation=classification["user_friendly_explanation"],
        source=req.source or "frontend",
        stack_trace=req.stack_trace,
        path=req.path,
    )
    db.add(error_entry)
    db.commit()
    db.refresh(error_entry)

    # Trigger automatic log retention pruning
    prune_error_logs(db)

    return {
        "id": error_entry.id,
        "category": error_entry.category,
        "category_label": error_entry.category_label,
        "user_friendly_explanation": error_entry.user_friendly_explanation,
        "message": "Error logged successfully"
    }

@router.get("")
@router.get("/")
def get_error_logs(
    category: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve categorized error logs."""
    query = db.query(ErrorLog)
    if category:
        query = query.filter(ErrorLog.category == category)
    
    logs = query.order_by(ErrorLog.timestamp.desc()).limit(limit).all()
    return logs

@router.delete("")
@router.delete("/")
def clear_error_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all system error logs immediately."""
    count = db.query(ErrorLog).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Cleared {count} error log entries immediately.", "cleared_count": count}

@router.get("/settings")
def get_error_log_settings(db: Session = Depends(get_db)):
    """Get system log retention settings."""
    max_entries_s = db.query(Settings).filter(Settings.key == "error_log_max_entries").first()
    max_days_s = db.query(Settings).filter(Settings.key == "error_log_max_days").first()

    return {
        "max_entries": int(max_entries_s.value) if max_entries_s and max_entries_s.value and max_entries_s.value.isdigit() else 1000,
        "max_days": int(max_days_s.value) if max_days_s and max_days_s.value and max_days_s.value.isdigit() else 30
    }

@router.put("/settings")
def update_error_log_settings(
    req: ErrorLogSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update system log retention settings and trigger pruning."""
    def set_setting(key: str, val: str):
        item = db.query(Settings).filter(Settings.key == key).first()
        if not item:
            item = Settings(key=key, value=val)
            db.add(item)
        else:
            item.value = val

    set_setting("error_log_max_entries", str(req.max_entries))
    set_setting("error_log_max_days", str(req.max_days))
    db.commit()

    # Trigger retention pruning immediately upon saving settings
    prune_error_logs(db)

    return {"message": "System log error retention settings updated successfully."}
