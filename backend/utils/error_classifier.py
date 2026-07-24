/**
 * Error Classifier Utility for Voyarr.
 * Classifies raw errors into 3 user-friendly categories:
 * 1. local_dev: Local Dev Environment Limitation
 * 2. external_service: Unconnected Service / External Layer Offline
 * 3. app_bug: Fixable Application Bug (Fix Locally Now)
 */
import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

def classify_error(message: str, stack_trace: str = "", status_code: int = 500) -> dict:
    combined = f"{message} {stack_trace}".lower()

    # 1. Local Dev Environment Limitation
    local_dev_patterns = [
        r"passkey", r"webauthn", r"fido2", r"https", r"ssl connection has been closed",
        r"localhost", r"clearbit\.com", r"cors", r"origin", r"cross-origin",
        r"permission denied", r"read-only file system", r"address already in use"
    ]
    for pattern in local_dev_patterns:
        if re.search(pattern, combined):
            return {
                "category": "local_dev",
                "category_label": "Local Dev Environment Limitation",
                "user_friendly_explanation": (
                    "This action requires production domain/HTTPS setup or specific host configuration. "
                    "Operating safely in Local Development Mode."
                )
            }

    # 2. Unconnected Service / External Layer Offline
    external_patterns = [
        r"502 bad gateway", r"503 service unavailable", r"504 gateway timeout",
        r"err_name_not_resolved", r"connection refused", r"name or service not known",
        r"networkerror", r"failed to fetch", r"scrape-url", r"http 502", r"http 503"
    ]
    if status_code in [502, 503, 504]:
        return {
            "category": "external_service",
            "category_label": "Unconnected Service / External Layer Offline",
            "user_friendly_explanation": (
                "Unable to reach external website or service (provider offline, rate-limited, or blocking requests). "
                "Local application remains stable."
            )
        }

    for pattern in external_patterns:
        if re.search(pattern, combined):
            return {
                "category": "external_service",
                "category_label": "Unconnected Service / External Layer Offline",
                "user_friendly_explanation": (
                    "Unable to reach external website or service (provider offline, rate-limited, or blocking requests). "
                    "Local application remains stable."
                )
            }

    # 3. Fixable Application Bug
    return {
        "category": "app_bug",
        "category_label": "Fixable Application Bug",
        "user_friendly_explanation": (
            "An application code issue occurred in a UI component, API handler, or database query. "
            "This can be debugged and resolved in local code."
        )
    }

def prune_error_logs(db: Session):
    """
    Prunes error logs in database according to max entries and max age settings.
    """
    from models import ErrorLog, Settings

    try:
        # 1. Age-based pruning
        max_days_setting = db.query(Settings).filter(Settings.key == "error_log_max_days").first()
        max_days = int(max_days_setting.value) if max_days_setting and max_days_setting.value and max_days_setting.value.isdigit() else 30
        
        if max_days > 0:
            cutoff_date = datetime.utcnow() - timedelta(days=max_days)
            db.query(ErrorLog).filter(ErrorLog.timestamp < cutoff_date).delete(synchronize_session=False)
            db.commit()

        # 2. Max entries pruning
        max_entries_setting = db.query(Settings).filter(Settings.key == "error_log_max_entries").first()
        max_entries = int(max_entries_setting.value) if max_entries_setting and max_entries_setting.value and max_entries_setting.value.isdigit() else 1000

        if max_entries > 0:
            total_count = db.query(ErrorLog).count()
            if total_count > max_entries:
                overflow = total_count - max_entries
                oldest_ids = [
                    e.id for e in db.query(ErrorLog.id).order_by(ErrorLog.timestamp.asc()).limit(overflow).all()
                ]
                if oldest_ids:
                    db.query(ErrorLog).filter(ErrorLog.id.in_(oldest_ids)).delete(synchronize_session=False)
                    db.commit()
    except Exception as e:
        db.rollback()
