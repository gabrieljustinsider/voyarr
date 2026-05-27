import os
import asyncio
from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import redis.asyncio as aioredis
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models import NotificationPreference, NotificationRule, NotificationLog, User
from routers.auth import get_current_user
from dependencies import verify_api_key

router = APIRouter(prefix="/notifications", tags=["notifications"])


# --- Pydantic Schemas ---
class PreferenceUpdate(BaseModel):
    event_type: str
    dispatch_method: str
    enabled: bool


class RuleCreate(BaseModel):
    event_type: str
    discord_channel_id: Optional[str] = None
    webhook_url: Optional[str] = None
    is_active: Optional[bool] = True


class MarkReadRequest(BaseModel):
    notification_ids: Optional[List[int]] = None  # If None, marks all as read


# --- Endpoints ---


async def event_generator(request: Request):
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis_client = aioredis.from_url(redis_url)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("notifications")
    last_ping = asyncio.get_event_loop().time()
    try:
        while True:
            if await request.is_disconnected():
                break
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message:
                data = message["data"].decode("utf-8")
                yield f"data: {data}\n\n"
            
            # Send keep-alive comment every 15 seconds to prevent reverse proxy (Nginx) 504 Gateway Timeout
            now = asyncio.get_event_loop().time()
            if now - last_ping > 15.0:
                yield ": ping\n\n"
                last_ping = now
                
            await asyncio.sleep(0.1)
    finally:
        await pubsub.unsubscribe("notifications")
        await pubsub.close()
        await redis_client.close()


@router.get("/stream")
async def stream_notifications(
    request: Request, api_key: str = Depends(verify_api_key)
):
    return StreamingResponse(event_generator(request), media_type="text/event-stream")


@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Retrieve delivery preferences for the current authenticated user."""
    prefs = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .all()
    )

    # If no preferences exist, return reasonable defaults
    if not prefs:
        default_prefs = []
        for etype in ["task_completed", "favorite_updated"]:
            for method in ["toast", "discord_dm"]:
                default_prefs.append(
                    {
                        "event_type": etype,
                        "dispatch_method": method,
                        "enabled": method
                        == "toast",  # toast enabled by default, discord_dm disabled by default
                    }
                )
        return default_prefs

    return prefs


@router.post("/preferences")
def update_preferences(
    reqs: List[PreferenceUpdate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update or create preferences for the current user."""
    for update in reqs:
        pref = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.user_id == current_user.id,
                NotificationPreference.event_type == update.event_type,
                NotificationPreference.dispatch_method == update.dispatch_method,
            )
            .first()
        )

        if pref:
            pref.enabled = update.enabled
        else:
            new_pref = NotificationPreference(
                user_id=current_user.id,
                event_type=update.event_type,
                dispatch_method=update.dispatch_method,
                enabled=update.enabled,
            )
            db.add(new_pref)
    db.commit()
    return {"message": "Notification preferences updated successfully."}


@router.get("/rules")
def get_rules(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all admin notification routing rules. Admins only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RBAC Forbidden: Only administrators can view routing rules.",
        )
    return db.query(NotificationRule).all()


@router.post("/rules")
def create_rule(
    req: RuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a notification routing rule. Admins only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RBAC Forbidden: Only administrators can manage routing rules.",
        )

    # Check if a rule for this combo already exists to avoid duplicates
    rule = (
        db.query(NotificationRule)
        .filter(
            NotificationRule.event_type == req.event_type,
            NotificationRule.discord_channel_id == req.discord_channel_id,
            NotificationRule.webhook_url == req.webhook_url,
        )
        .first()
    )

    if rule:
        rule.is_active = req.is_active
    else:
        rule = NotificationRule(
            event_type=req.event_type,
            discord_channel_id=req.discord_channel_id,
            webhook_url=req.webhook_url,
            is_active=req.is_active,
        )
        db.add(rule)

    db.commit()
    db.refresh(rule)
    return {"message": "Notification rule saved successfully.", "rule": rule}


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a custom notification rule. Admins only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RBAC Forbidden: Only administrators can manage routing rules.",
        )
    rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "Notification rule deleted successfully."}


@router.get("/history")
def get_history(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get the recent notification logs for the current user."""
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.user_id == current_user.id)
        .order_by(NotificationLog.created_at.desc())
        .limit(50)
        .all()
    )
    return logs


@router.post("/read")
def mark_as_read(
    req: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark specific notification logs as read, or all if none specified."""
    query = db.query(NotificationLog).filter(NotificationLog.user_id == current_user.id)
    if req.notification_ids:
        query = query.filter(NotificationLog.id.in_(req.notification_ids))

    logs = query.all()
    for log in logs:
        log.read = True

    db.commit()
    return {"message": f"Marked {len(logs)} notifications as read."}
