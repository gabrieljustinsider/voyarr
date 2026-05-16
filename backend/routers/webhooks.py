from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Webhook
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from dependencies import verify_api_key
from rate_limiter import rate_limit

router = APIRouter(
    prefix="/webhooks", tags=["webhooks"], dependencies=[Depends(verify_api_key)]
)


class WebhookCreate(BaseModel):
    name: str
    url: HttpUrl
    events: Optional[List[str]] = None


@router.get("/")
def get_webhooks(db: Session = Depends(get_db)):
    return db.query(Webhook).all()


@router.post(
    "/", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
def create_webhook(webhook: WebhookCreate, db: Session = Depends(get_db)):
    db_wh = Webhook(name=webhook.name, url=str(webhook.url), events=webhook.events)
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    return db_wh


@router.delete("/{webhook_id}")
def delete_webhook(webhook_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(db_wh)
    db.commit()
    return {"message": "Webhook deleted"}
