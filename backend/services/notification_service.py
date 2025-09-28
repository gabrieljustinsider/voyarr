import os
import json
import redis
import requests
import logging
from sqlalchemy.orm import Session
from models import (
    NotificationPreference,
    NotificationRule,
    NotificationLog,
    UserPreference,
    User,
    Favorite,
)

logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    def get_redis_client():
        try:
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
            return redis.Redis.from_url(redis_url)
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            return None

    @staticmethod
    def publish_toast(event_payload: dict):
        """Publishes notification to Redis channel for SSE streaming to frontend."""
        client = NotificationService.get_redis_client()
        if client:
            try:
                client.publish("notifications", json.dumps(event_payload))
            except Exception as e:
                logger.error(f"Failed to publish toast: {e}")

    @staticmethod
    def send_discord_webhook(url: str, message: str):
        """Dispatches an incoming Discord webhook message."""
        try:
            payload = {"content": message}
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code not in [200, 204]:
                logger.error(
                    f"Discord webhook returned status {resp.status_code}: {resp.text}"
                )
        except Exception as e:
            logger.error(f"Failed to dispatch Discord Webhook: {e}")

    @staticmethod
    def send_discord_dm(bot_token: str, discord_user_id: str, message: str):
        """Creates a DM channel with a user and dispatches a message via bot token."""
        try:
            headers = {
                "Authorization": f"Bot {bot_token}",
                "Content-Type": "application/json",
            }
            # 1. Create DM channel
            dm_channel_url = "https://discord.com/api/v10/users/@me/channels"
            channel_resp = requests.post(
                dm_channel_url,
                json={"recipient_id": discord_user_id},
                headers=headers,
                timeout=5,
            )
            if channel_resp.status_code != 200:
                logger.error(
                    f"Failed to open Discord DM channel for {discord_user_id}: {channel_resp.text}"
                )
                return

            channel_id = channel_resp.json().get("id")
            if not channel_id:
                return

            # 2. Post message to DM channel
            msg_url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
            msg_resp = requests.post(
                msg_url, json={"content": message}, headers=headers, timeout=5
            )
            if msg_resp.status_code not in [200, 201]:
                logger.error(
                    f"Failed to send Discord DM message to channel {channel_id}: {msg_resp.text}"
                )
        except Exception as e:
            logger.error(f"Failed to send Discord DM: {e}")

    @staticmethod
    def notify_user(
        db: Session, user_id: int, event_type: str, title: str, message: str
    ):
        """Creates a user notification, logs it, checks preferences, and dispatches to active delivery methods."""
        # 1. Write to NotificationLog
        log_entry = NotificationLog(
            user_id=user_id,
            event_type=event_type,
            title=title,
            message=message,
            read=False,
        )
        db.add(log_entry)
        db.commit()

        # 2. Query preferences
        prefs = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type,
                NotificationPreference.enabled == True,  # noqa: E712
            )
            .all()
        )

        dispatch_methods = (
            [p.dispatch_method for p in prefs] if prefs else ["toast"]
        )  # Default to browser toast

        # Browser Toast via Redis SSE
        if "toast" in dispatch_methods:
            NotificationService.publish_toast(
                {
                    "id": log_entry.id,
                    "user_id": user_id,
                    "event_type": event_type,
                    "title": title,
                    "message": message,
                    "created_at": str(log_entry.created_at),
                }
            )

        # Discord DM
        if "discord_dm" in dispatch_methods:
            # Fetch user's Discord ID from UserPreference
            user_pref = (
                db.query(UserPreference)
                .filter(UserPreference.user_id == user_id)
                .first()
            )
            discord_id = None
            if user_pref and user_pref.ui_config:
                discord_id = user_pref.ui_config.get("discord_user_id")

            # Fetch Bot Token from Settings
            from models import Settings

            bot_token_setting = (
                db.query(Settings).filter(Settings.key == "discord_bot_token").first()
            )
            bot_token = (
                bot_token_setting.value
                if bot_token_setting
                else os.getenv("DISCORD_BOT_TOKEN")
            )

            if discord_id and bot_token:
                full_message = f"🔔 **{title}**\n{message}"
                NotificationService.send_discord_dm(bot_token, discord_id, full_message)
            else:
                logger.warning(
                    f"Unable to send Discord DM: discord_user_id={discord_id is not None}, bot_token={bot_token is not None}"
                )

    @staticmethod
    def notify_global(db: Session, event_type: str, title: str, message: str):
        """Dispatches an event globally to all active users and evaluates admin custom notification routing rules."""
        # 1. Notify all active users
        users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
        for u in users:
            try:
                NotificationService.notify_user(db, u.id, event_type, title, message)
            except Exception as e:
                logger.error(f"Failed to notify user {u.id}: {e}")

        # 2. Evaluate Admin Rules (NotificationRule)
        rules = (
            db.query(NotificationRule)
            .filter(
                NotificationRule.event_type == event_type,
                NotificationRule.is_active == True,  # noqa: E712
            )
            .all()
        )

        for r in rules:
            try:
                full_message = (
                    f"📣 **System Update [{event_type}]**\n**{title}**\n{message}"
                )
                if r.webhook_url:
                    NotificationService.send_discord_webhook(
                        r.webhook_url, full_message
                    )
                elif r.discord_channel_id:
                    # Send via Bot Token to Channel
                    from models import Settings

                    bot_token_setting = (
                        db.query(Settings)
                        .filter(Settings.key == "discord_bot_token")
                        .first()
                    )
                    bot_token = (
                        bot_token_setting.value
                        if bot_token_setting
                        else os.getenv("DISCORD_BOT_TOKEN")
                    )
                    if bot_token:
                        url = f"https://discord.com/api/v10/channels/{r.discord_channel_id}/messages"
                        headers = {
                            "Authorization": f"Bot {bot_token}",
                            "Content-Type": "application/json",
                        }
                        requests.post(
                            url,
                            json={"content": full_message},
                            headers=headers,
                            timeout=5,
                        )
            except Exception as e:
                logger.error(f"Failed to dispatch notification rule {r.id}: {e}")

    @staticmethod
    def check_and_notify_favorites(db: Session, entry):
        """Checks if a newly committed LibraryEntry matches any user's favorite performers, studios, categories, tags or movies."""
        try:
            # 1. Fetch all favorites
            favorites = db.query(Favorite).all()
            if not favorites:
                return

            # Group favorites by user to prevent spamming
            user_matches = {}

            for fav in favorites:
                matched = False
                matched_reason = ""

                # Lowercase items for comparison
                val = str(fav.item_id).lower()

                if fav.item_type == "performer" and entry.performers:
                    perf_list = [p.lower() for p in entry.performers]
                    if val in perf_list:
                        matched = True
                        matched_reason = f"performer '{fav.item_id}'"

                elif fav.item_type == "tag" and entry.tags:
                    tag_list = [t.lower() for t in entry.tags]
                    if val in tag_list:
                        matched = True
                        matched_reason = f"tag '{fav.item_id}'"

                elif fav.item_type == "studio":
                    # Check studio relation
                    if entry.provider and entry.provider.name.lower() == val:
                        matched = True
                        matched_reason = f"studio '{fav.item_id}'"
                    # Also check studio tags or naming
                    elif entry.entry_metadata and "studio" in entry.entry_metadata:
                        studio_meta = str(
                            entry.entry_metadata.get("studio", "")
                        ).lower()
                        if val == studio_meta:
                            matched = True
                            matched_reason = f"studio '{fav.item_id}'"

                elif fav.item_type == "movie":
                    if entry.title and val in entry.title.lower():
                        matched = True
                        matched_reason = f"movie/title '{fav.item_id}'"

                if matched:
                    if fav.user_id not in user_matches:
                        user_matches[fav.user_id] = []
                    user_matches[fav.user_id].append(matched_reason)

            # Send notifications to users who had matches
            for user_id, reasons in user_matches.items():
                reasons_str = ", ".join(reasons)
                title = "New Favorite Match Cataloged!"
                message = f"'{entry.title}' matches your favorited {reasons_str}."
                NotificationService.notify_user(
                    db, user_id, "favorite_updated", title, message
                )

        except Exception as e:
            logger.error(f"Error checking and notifying favorites: {e}")
