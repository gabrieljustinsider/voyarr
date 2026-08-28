import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import asyncio
from sqlalchemy.orm import Session
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from database import get_db
from models import MediaRequest, LibraryEntry, Settings, User
from tasks.scrape_tasks import scrape_url_task
from routers.download import validate_url_ssrf

router = APIRouter(prefix="/discord", tags=["discord"])
logger = logging.getLogger(__name__)


def verify_signature(request: Request, body: bytes):
    public_key = os.getenv("DISCORD_PUBLIC_KEY")
    if not public_key:
        logger.error("DISCORD_PUBLIC_KEY is not set. Cannot verify Discord requests.")
        raise HTTPException(
            status_code=401, detail="Discord integration is not configured properly."
        )

    signature = request.headers.get("X-Signature-Ed25519")
    timestamp = request.headers.get("X-Signature-Timestamp")

    if not signature or not timestamp:
        raise HTTPException(status_code=401, detail="Missing signature headers")

    try:
        verify_key = VerifyKey(bytes.fromhex(public_key))
        verify_key.verify(timestamp.encode() + body, bytes.fromhex(signature))
    except BadSignatureError:
        raise HTTPException(status_code=401, detail="Invalid request signature")
    except Exception as e:
        logger.error(f"Error during Discord signature verification: {str(e)}")
        raise HTTPException(status_code=401, detail="Could not verify signature")
    return True


def is_user_authorized(db: Session, user_id: str) -> bool:
    """Checks if the user ID is in the allowed users list (or if the list is empty/unset, allowing all)."""
    setting = db.query(Settings).filter(Settings.key == "discord_allowed_users").first()
    if not setting or not setting.value:
        return True  # If no setting is configured, default to open access
    allowed_users = [u.strip() for u in setting.value.split(",")]
    return user_id in allowed_users


def get_user_role_from_discord(
    db: Session, discord_user_id: str, discord_username: str
) -> str:
    """Resolve local User role matching the Discord account identity."""
    # 1. Check if mapping setting exists
    mapping_setting = (
        db.query(Settings).filter(Settings.key == "discord_user_mappings").first()
    )
    if mapping_setting and mapping_setting.value:
        try:
            mapping = json.loads(mapping_setting.value)
            local_username = mapping.get(discord_user_id)
            if local_username:
                user = db.query(User).filter(User.username == local_username).first()
                if user:
                    return user.role
        except Exception as e:
            logger.error(f"Error parsing discord_user_mappings: {e}")

    # 2. Try direct match on username
    user = db.query(User).filter(User.username.ilike(discord_username)).first()
    if user:
        return user.role

    # 3. Default fallback
    return "viewer"


def _process_discord_command(db: Session, interaction_type: int, data: dict):
    """Synchronous worker offloaded to a thread to prevent DB calls from blocking the event loop."""
    if interaction_type == 2:
        command_data = data.get("data", {})
        command_name = command_data.get("name")
        options = command_data.get("options", [])

        user_data = data.get("member", {}).get("user", {}) or data.get("user", {})
        username = user_data.get("username", "Unknown Discord User")
        user_id = str(user_data.get("id", ""))

        if not is_user_authorized(db, user_id):
            logger.warning(
                f"Unauthorized Discord command attempt from {username} ({user_id})"
            )
            return JSONResponse(
                {
                    "type": 4,
                    "data": {
                        "content": "❌ You are not authorized to use Voyarr commands."
                    },
                }
            )

        # Enforce RBAC Role limits
        user_role = get_user_role_from_discord(db, user_id, username)

        # Resolve local user model for fine-grained permissions checks
        local_user = None
        mapping_setting = db.query(Settings).filter(Settings.key == "discord_user_mappings").first()
        if mapping_setting and mapping_setting.value:
            try:
                mapping = json.loads(mapping_setting.value)
                local_username = mapping.get(user_id)
                if local_username:
                    local_user = db.query(User).filter(User.username == local_username).first()
            except Exception:
                pass
        if not local_user:
            local_user = db.query(User).filter(User.username.ilike(username)).first()

        # Command: /request (Access: Admin/User/Viewer)
        if command_name == "request":
            title = None
            url = None
            for opt in options:
                if opt.get("name") == "title":
                    title = opt.get("value")
                elif opt.get("name") == "url":
                    url = opt.get("value")

            if not title:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {"content": "Failed to create request: missing title."},
                    }
                )

            db_req = MediaRequest(
                title=title, url=url, requested_by=f"Discord: {username}", status="pending"
            )
            db.add(db_req)
            db.commit()
            db.refresh(db_req)

            # Post approval buttons to designated Discord Admin Channel if configured
            admin_channel_setting = db.query(Settings).filter(Settings.key == "discord_admin_channel_id").first()
            admin_channel_id = admin_channel_setting.value if admin_channel_setting else os.getenv("DISCORD_ADMIN_CHANNEL_ID")

            bot_token_setting = db.query(Settings).filter(Settings.key == "discord_bot_token").first()
            bot_token = bot_token_setting.value if bot_token_setting else os.getenv("DISCORD_BOT_TOKEN")

            if admin_channel_id and bot_token:
                import requests
                msg_url = f"https://discord.com/api/v10/channels/{admin_channel_id}/messages"
                headers = {
                    "Authorization": f"Bot {bot_token}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "content": "🔔 **New Media Request Submitted**",
                    "embeds": [
                        {
                            "title": f"Media Request: {title}",
                            "description": f"URL: {url or 'None'}\nRequested by: Discord: {username}\nStatus: 🟡 **Pending Approval**",
                            "color": 3447003
                        }
                    ],
                    "components": [
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 2,
                                    "style": 3,
                                    "label": "Approve",
                                    "custom_id": f"approve_request_{db_req.id}"
                                },
                                {
                                    "type": 2,
                                    "style": 4,
                                    "label": "Reject",
                                    "custom_id": f"reject_request_{db_req.id}"
                                }
                            ]
                        }
                    ]
                }
                try:
                    requests.post(msg_url, json=payload, headers=headers, timeout=5)
                except Exception as e:
                    logger.error(f"Failed to post approval buttons to Discord: {e}")

            return JSONResponse(
                {
                    "type": 4,
                    "data": {
                        "content": f"✅ Successfully submitted media request for **{title}**."
                    },
                }
            )

        # Command: /search (Access: Admin/User/Viewer)
        elif command_name == "search":
            query = None
            for opt in options:
                if opt.get("name") == "query":
                    query = opt.get("value")

            if not query:
                return JSONResponse(
                    {"type": 4, "data": {"content": "Please provide a search query."}}
                )

            results = (
                db.query(LibraryEntry)
                .filter(LibraryEntry.title.ilike(f"%{query}%"))
                .limit(5)
                .all()
            )

            if not results:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {"content": f"🔍 No results found for **{query}**."},
                    }
                )

            response_text = f"🔍 **Search results for '{query}':**\n"
            for res in results:
                res_str = res.resolution or "Unknown Res"
                response_text += f"- {res.title} ({res_str})\n"

            return JSONResponse({"type": 4, "data": {"content": response_text}})

        # Command: /add (Access: Admin)
        elif command_name == "add":
            from db_utils import is_feature_enabled
            if not is_feature_enabled(db, "scraping", local_user):
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Forbidden: The scraping feature is disabled globally or you do not have permission."
                        },
                    }
                )

            if user_role != "admin":
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Forbidden: Only Voyarr Administrators can add and approve items directly."
                        },
                    }
                )

            url = None
            title = "Discord Added Item"
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")
                elif opt.get("name") == "title":
                    title = opt.get("value")

            if not url:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {"content": "❌ Failed to add item: missing URL."},
                    }
                )

            try:
                validate_url_ssrf(url)
            except HTTPException:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Failed to add item: URL is invalid or points to an internal network."
                        },
                    }
                )

            scrape_url_task.delay(url)
            return JSONResponse(
                {
                    "type": 4,
                    "data": {"content": f"✅ Added **{title}** to the download queue."},
                }
            )

        # Command: /scrape (Access: Admin/User)
        elif command_name == "scrape":
            from db_utils import is_feature_enabled
            if not is_feature_enabled(db, "scraping", local_user):
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Forbidden: The scraping feature is disabled globally or you do not have permission."
                        },
                    }
                )

            if user_role not in ["admin", "user"]:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Forbidden: You do not have permission to trigger scrapes."
                        },
                    }
                )

            url = None
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")

            if not url:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {"content": "❌ Please provide a URL to scrape."},
                    }
                )

            try:
                validate_url_ssrf(url)
            except HTTPException:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {
                            "content": "❌ Failed to trigger scrape: URL is invalid or points to an internal network."
                        },
                    }
                )

            scrape_url_task.delay(url)
            return JSONResponse(
                {"type": 4, "data": {"content": f"✅ Scrape job initiated for {url}."}}
            )

        # Command: /status (Access: Admin/User/Viewer)
        elif command_name == "status":
            import platform
            import shutil
            import datetime
            from sqlalchemy import text
            from database import engine

            # 1. DB check
            db_status = "🟢 Dialect: " + engine.name
            try:
                db.execute(text("SELECT 1"))
            except Exception:
                db_status = "🔴 Connection failed"

            # 2. Redis Check
            import urllib.parse
            import socket
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
            parsed = urllib.parse.urlparse(redis_url)
            host = parsed.hostname or "redis"
            port = parsed.port or 6379
            socket.setdefaulttimeout(1.0)
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.connect((host, port))
                s.close()
                redis_status = "🟢 Healthy"
            except Exception:
                redis_status = "🔴 Connection failed"

            # 3. Environment details
            is_docker = os.path.exists("/.dockerenv")
            if not is_docker:
                try:
                    with open("/proc/1/cgroup", "rt") as f:
                        is_docker = "docker" in f.read()
                except Exception:
                    pass

            now = datetime.datetime.now().astimezone()
            system_time_str = now.strftime("%Y-%m-%d %H:%M:%S ") + (now.tzname() or "UTC")

            # Disk usage
            storage_usage = "Unknown"
            try:
                total, used, free = shutil.disk_usage("/media/storage")
                used_gb = round(used / (1024**3), 2)
                total_gb = round(total / (1024**3), 2)
                percent = round((used / total) * 100, 2)
                storage_usage = f"{used_gb} GB / {total_gb} GB ({percent}%)"
            except Exception:
                pass

            embed = {
                "title": "📋 Voyarr System Status",
                "color": 3447003,
                "fields": [
                    {"name": "Database Status", "value": db_status, "inline": True},
                    {"name": "Redis Status", "value": redis_status, "inline": True},
                    {"name": "Docker Container", "value": "🟢 Yes" if is_docker else "❌ No", "inline": True},
                    {"name": "System Time", "value": system_time_str, "inline": False},
                    {"name": "Media Storage Usage", "value": storage_usage, "inline": False},
                    {"name": "OS Platform", "value": f"{platform.system()} {platform.release()}", "inline": False},
                ],
                "footer": {
                    "text": "Voyarr Status Telemetry"
                }
            }

            return JSONResponse({
                "type": 4,
                "data": {
                    "embeds": [embed]
                }
            })

    elif interaction_type == 3:
        # Message component (button click)
        component_data = data.get("data", {})
        custom_id = component_data.get("custom_id", "")
        
        user_data = data.get("member", {}).get("user", {}) or data.get("user", {})
        username = user_data.get("username", "Unknown Discord User")
        user_id = str(user_data.get("id", ""))
        
        # Check if the user is authorized and has admin role
        if not is_user_authorized(db, user_id):
            return JSONResponse({
                "type": 4,
                "data": {"content": "❌ You are not authorized to interact with Voyarr.", "flags": 64}
            })
            
        user_role = get_user_role_from_discord(db, user_id, username)
        if user_role != "admin":
            return JSONResponse({
                "type": 4,
                "data": {"content": "❌ Forbidden: Only administrators can approve/reject requests.", "flags": 64}
            })

        if custom_id.startswith("approve_request_") or custom_id.startswith("reject_request_"):
            action = "approve" if custom_id.startswith("approve_request_") else "reject"
            req_id = int(custom_id.split("_")[-1])
            db_req = db.query(MediaRequest).filter(MediaRequest.id == req_id).first()
            if not db_req:
                return JSONResponse({
                    "type": 4,
                    "data": {"content": "❌ Request not found.", "flags": 64}
                })
                
            if action == "approve":
                db_req.status = "approved"
                db.commit()
                
                # If a URL is attached, automatically kick off the scrape task!
                if db_req.url:
                    try:
                        validate_url_ssrf(db_req.url)
                        scrape_url_task.delay(db_req.url)
                    except Exception:
                        pass
                
                return JSONResponse({
                    "type": 7, # Update original message
                    "data": {
                        "content": f"✅ Media request for **{db_req.title}** has been **approved** by @{username}!",
                        "embeds": [
                            {
                                "title": f"Media Request: {db_req.title}",
                                "description": f"URL: {db_req.url or 'None'}\nRequested by: {db_req.requested_by}\nStatus: 🟢 **Approved**",
                                "color": 3066993,
                            }
                        ],
                        "components": [] # Remove the buttons
                    }
                })
            else:
                db_req.status = "rejected"
                db.commit()
                
                return JSONResponse({
                    "type": 7, # Update original message
                    "data": {
                        "content": f"❌ Media request for **{db_req.title}** has been **rejected** by @{username}.",
                        "embeds": [
                            {
                                "title": f"Media Request: {db_req.title}",
                                "description": f"URL: {db_req.url or 'None'}\nRequested by: {db_req.requested_by}\nStatus: 🔴 **Rejected**",
                                "color": 15158332,
                            }
                        ],
                        "components": [] # Remove the buttons
                    }
                })

    return JSONResponse({"type": 4, "data": {"content": "Unknown command or interaction type."}})


@router.get("")
@router.get("/")
@router.get("/interactions")
async def discord_handshake():
    return JSONResponse({
        "status": "HANDSHAKE_READY",
        "endpoint": "/api/v1/discord/interactions",
        "service": "voyarr"
    })


@router.post("")
@router.post("/")
@router.post("/interactions")
async def discord_interactions(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    verify_signature(request, body)

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    interaction_type = data.get("type")

    # Discord PING
    if interaction_type == 1:
        return JSONResponse({"type": 1})

    # Discord Application Command
    # Offload blocking database operations to a background thread
    return await asyncio.to_thread(_process_discord_command, db, interaction_type, data)
