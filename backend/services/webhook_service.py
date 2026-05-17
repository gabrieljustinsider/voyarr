import requests
import urllib.parse
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
                        parsed = urllib.parse.urlparse(wh.url)
                        hostname = parsed.hostname.lower() if parsed.hostname else ""

                        try:
                            import ipaddress

                            if hostname.startswith("0x"):
                                ip_int = int(hostname, 16)
                            elif hostname.startswith("0") and hostname.isdigit():
                                ip_int = int(hostname, 8)
                            elif hostname.isdigit():
                                ip_int = int(hostname)
                            else:
                                ip_int = None
                            if ip_int is not None and (
                                ipaddress.ip_address(ip_int).is_loopback
                                or ipaddress.ip_address(ip_int).is_private
                            ):
                                logger.warning(
                                    f"SSRF blocked: Disallowed internal numeric IP {hostname} in webhook {wh.name}"
                                )
                                continue
                        except ValueError:
                            pass

                        if hostname in [
                            "localhost",
                            "127.0.0.1",
                            "0.0.0.0",
                            "169.254.169.254",
                            "::1",
                            "[::1]",
                        ] or hostname.endswith(
                            (".internal", ".nip.io", ".xip.io", ".sslip.io")
                        ):
                            logger.warning(
                                f"SSRF blocked: Disallowed internal hostname {hostname} in webhook {wh.name}"
                            )
                            continue
                    except Exception:
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
