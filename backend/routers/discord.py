import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from database import get_db
from models import (
    MediaRequest,
    LibraryEntry,
    Settings,
    User,
    Favorite,
    UserVideoStats,
    UserHistory,
    LiveStream,
    Studio
)
from tasks.scrape_tasks import scrape_url_task

router = APIRouter(prefix="/discord", tags=["discord"])
logger = logging.getLogger(__name__)


def verify_signature(request: Request, body: bytes):
    public_key = os.getenv("DISCORD_PUBLIC_KEY")
    if not public_key:
        logger.warning("DISCORD_PUBLIC_KEY is not set. Discord signature verification is BYPASSED.")
        return True

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


def get_user_role_from_discord(db: Session, discord_user_id: str, discord_username: str) -> str:
    """Resolve local User role matching the Discord account identity."""
    # 1. Check if mapping setting exists
    mapping_setting = db.query(Settings).filter(Settings.key == "discord_user_mappings").first()
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
    if interaction_type == 2:
        command_data = data.get("data", {})
        command_name = command_data.get("name")
        options = command_data.get("options", [])
        
        user_data = data.get("member", {}).get("user", {}) or data.get("user", {})
        username = user_data.get("username", "Unknown Discord User")
        user_id = str(user_data.get("id", ""))

        if not is_user_authorized(db, user_id):
            logger.warning(f"Unauthorized Discord command attempt from {username} ({user_id})")
            return JSONResponse({"type": 4, "data": {"content": "❌ You are not authorized to use Voyarr commands."}})

        # Enforce RBAC Role limits
        user_role = get_user_role_from_discord(db, user_id, username)

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
                return JSONResponse({"type": 4, "data": {"content": "Failed to create request: missing title."}})

            db_req = MediaRequest(title=title, url=url, requested_by=f"Discord: {username}")
            db.add(db_req)
            db.commit()

            return JSONResponse({"type": 4, "data": {"content": f"✅ Successfully submitted media request for **{title}**."}})

        # Command: /search (Access: Admin/User/Viewer)
        elif command_name == "search":
            query = None
            for opt in options:
                if opt.get("name") == "query":
                    query = opt.get("value")
            
            if not query:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a search query."}})
                
            results = db.query(LibraryEntry).filter(LibraryEntry.title.ilike(f"%{query}%")).limit(5).all()
            
            if not results:
                return JSONResponse({"type": 4, "data": {"content": f"🔍 No results found for **{query}**."}})
                
            response_text = f"🔍 **Search results for '{query}':**\n"
            for res in results:
                res_str = res.resolution or "Unknown Res"
                response_text += f"- {res.title} ({res_str})\n"
                
            return JSONResponse({"type": 4, "data": {"content": response_text}})

        # Command: /add (Access: Admin)
        elif command_name == "add":
            if user_role != "admin":
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Only Voyarr Administrators can add and approve items directly."}})

            url = None
            title = "Discord Added Item"
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")
                elif opt.get("name") == "title":
                    title = opt.get("value")
            
            if not url:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a URL to add."}})
                
            db_req = MediaRequest(title=title, url=url, status="approved", requested_by=f"Discord: {username}")
            db.add(db_req)
            db.commit()
            
            return JSONResponse({"type": 4, "data": {"content": f"📥 Added and approved **{title}** to the queue."}})

        # Command: /scrape (Access: Admin)
        elif command_name == "scrape":
            if user_role != "admin":
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Only Voyarr Administrators can trigger scraping tasks."}})

            url = None
            recipe_id = 1
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")
                elif opt.get("name") == "recipe_id":
                    recipe_id = int(opt.get("value"))
                    
            if not url:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a URL to scrape."}})
                
            scrape_url_task.delay(url, recipe_id)
            
            return JSONResponse({"type": 4, "data": {"content": f"🕸️ Triggered scrape job for **{url}** using recipe ID {recipe_id}."}})

        # Command: /stats (Access: Admin/User)
        elif command_name == "stats":
            if user_role not in ["admin", "user"]:
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Insufficient local user role."}})

            total_watch_seconds = db.query(func.sum(UserHistory.duration)).scalar() or 0
            total_plays = db.query(func.sum(UserVideoStats.play_count)).scalar() or 0
            total_climaxes = db.query(func.sum(UserVideoStats.climax_count)).scalar() or 0

            response_text = (
                "📊 **Voyarr Personalization Stats:**\n"
                f"- **Total Watch Hours:** {round(total_watch_seconds / 3600.0, 2)} hrs\n"
                f"- **Total Playbacks:** {total_plays}\n"
                f"- **Total O-Meter Climax tally:** {total_climaxes} 🚀"
            )
            return JSONResponse({"type": 4, "data": {"content": response_text}})

        # Command: /favorites (Access: Admin/User)
        elif command_name == "favorites":
            if user_role not in ["admin", "user"]:
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Insufficient local user role."}})

            # Find matching Voyarr user to pull their custom favorites
            local_user = db.query(User).filter(User.username.ilike(username)).first()
            if not local_user:
                # Try via mappings
                mapping_setting = db.query(Settings).filter(Settings.key == "discord_user_mappings").first()
                if mapping_setting and mapping_setting.value:
                    try:
                        mapping = json.loads(mapping_setting.value)
                        local_uname = mapping.get(user_id)
                        if local_uname:
                            local_user = db.query(User).filter(User.username == local_uname).first()
                    except Exception:
                        pass

            if not local_user:
                return JSONResponse({"type": 4, "data": {"content": "❌ No matching local Voyarr user profile linked to your Discord account."}})

            favs = db.query(Favorite).filter(Favorite.user_id == local_user.id).all()
            if not favs:
                return JSONResponse({"type": 4, "data": {"content": "❤️ **Your Favorites list is currently empty.**"}})

            performers = [f.item_id for f in favs if f.item_type == "performer"]
            scenes = [f.item_id for f in favs if f.item_type == "scene"]
            studios = [f.item_id for f in favs if f.item_type == "studio"]

            response_text = "❤️ **Your Favorited Items Summary:**\n"
            if performers:
                response_text += f"- **Performers:** {', '.join(performers[:10])}\n"
            if scenes:
                response_text += f"- **Scenes:** {len(scenes)} scenes\n"
            if studios:
                response_text += f"- **Studios:** {', '.join(studios[:10])}\n"

            return JSONResponse({"type": 4, "data": {"content": response_text}})

        # Command: /livestreams (Access: Admin/User)
        elif command_name == "livestreams":
            if user_role not in ["admin", "user"]:
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Insufficient local user role."}})

            streams = db.query(LiveStream).all()
            if not streams:
                return JSONResponse({"type": 4, "data": {"content": "🎥 **No live streams configured in Voyarr.**"}})

            response_text = "🎥 **Monitored Live Streams:**\n"
            for s in streams:
                size_mb = round(s.written_size / (1024.0 * 1024.0), 2)
                response_text += f"- **{s.name}**: status={s.status} | elapsed={s.elapsed_seconds}s | written={size_mb} MB\n"

            return JSONResponse({"type": 4, "data": {"content": response_text}})

        # Command: /record (Access: Admin)
        elif command_name == "record":
            if user_role != "admin":
                return JSONResponse({"type": 4, "data": {"content": "❌ Forbidden: Only Voyarr Administrators can trigger recordings."}})

            url = None
            name = None
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")
                elif opt.get("name") == "name":
                    name = opt.get("value")

            if not url:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a stream URL to record."}})

            if not name:
                name = f"Discord Recording {datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

            # Check if exists or create
            stream = db.query(LiveStream).filter(LiveStream.url == url).first()
            if not stream:
                stream = LiveStream(name=name, url=url, status="idle")
                db.add(stream)
                db.flush()

            if stream.status == "recording":
                return JSONResponse({"type": 4, "data": {"content": f"⚠️ **{stream.name}** is already recording."}})

            stream.status = "recording"
            stream.written_size = 0
            stream.elapsed_seconds = 0
            db.commit()

            # Trigger Celery Task
            from tasks.live_tasks import record_live_stream_task
            record_live_stream_task.delay(stream.id)

            return JSONResponse({"type": 4, "data": {"content": f"🔴 **Started background recording:** capture of **{stream.name}** is in progress."}})

        # Command: /studios (Access: Admin/User/Viewer)
        elif command_name == "studios":
            query = None
            for opt in options:
                if opt.get("name") == "query":
                    query = opt.get("value")

            if not query:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a query to search studios."}})

            results = db.query(Studio).filter(Studio.name.ilike(f"%{query}%")).limit(5).all()
            if not results:
                return JSONResponse({"type": 4, "data": {"content": f"🏢 No studios found matching **{query}**."}})

            response_text = f"🏢 **Studio Search results for '{query}':**\n"
            for s in results:
                parent_name = None
                if s.parent_id:
                    parent = db.query(Studio).filter(Studio.id == s.parent_id).first()
                    if parent:
                        parent_name = parent.name
                network_str = f" | Network={parent_name}" if parent_name else (" | Network=Parent" if s.is_network else "")
                response_text += f"- **{s.name}**{network_str} | URL={s.url or 'N/A'}\n"

            return JSONResponse({"type": 4, "data": {"content": response_text}})

    return JSONResponse({"type": 4, "data": {"content": "Unknown command"}})
