import requests
from models import Webhook
import logging
from db_utils import get_db_session

logger = logging.getLogger(__name__)


class WebhookService:
    @staticmethod
    def trigger(event_name: str, payload: dict):
        with get_db_session() as db:
            webhooks = db.query(Webhook).filter(Webhook.is_active).all()
            for wh in webhooks:
                # Check if the webhook subscribes to this specific event (or all events if empty)
                if not wh.events or event_name in wh.events:
                    try:
                        from utils import validate_url_ssrf
                        validate_url_ssrf(wh.url)
                    except Exception as ssrf_err:
                        logger.warning(
                            f"SSRF blocked: Disallowed or unsafe URL format in webhook {wh.name} ({wh.url}): {ssrf_err}"
                        )
                        continue
                    try:
                        data = {"event": event_name, "data": payload}
                        # Easy out-of-the-box Discord formatting
                        if "discord.com/api/webhooks" in wh.url:
                            payload_str = str(payload).replace("```", "'''")
                            if len(payload_str) > 1900:
                                payload_str = payload_str[:1897] + "..."
                            data = {
                                "content": f"**Voyarr Event: {event_name}**\n```{payload_str}```"
                            }
                        requests.post(wh.url, json=data, timeout=5)
                    except Exception as e:
                        logger.error(f"Failed to trigger webhook {wh.name}: {e}")
