import requests
from database import SessionLocal
from models import Webhook
import logging

logger = logging.getLogger(__name__)

class WebhookService:
    @staticmethod
    def trigger(event_name: str, payload: dict):
        db = SessionLocal()
        try:
            webhooks = db.query(Webhook).filter(Webhook.is_active == True).all()
            for wh in webhooks:
                # Check if the webhook subscribes to this specific event (or all events if empty)
                if not wh.events or event_name in wh.events:
                    try:
                        data = {
                            "event": event_name,
                            "data": payload
                        }
                        # Easy out-of-the-box Discord formatting
                        if "discord.com/api/webhooks" in wh.url:
                            data = {
                                "content": f"**Voyarr Event: {event_name}**\n```{payload}```"
                            }
                        requests.post(wh.url, json=data, timeout=5)
                    except Exception as e:
                        logger.error(f"Failed to trigger webhook {wh.name}: {e}")
        finally:
            db.close()