import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from database import get_db
from models import MediaRequest, LibraryEntry, DownloadQueue, Settings
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

        # Command: /request
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

        # Command: /search
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

        # Command: /add
        elif command_name == "add":
            url = None
            title = "Discord Added Item"
            for opt in options:
                if opt.get("name") == "url":
                    url = opt.get("value")
                elif opt.get("name") == "title":
                    title = opt.get("value")
            
            if not url:
                return JSONResponse({"type": 4, "data": {"content": "Please provide a URL to add."}})
                
            # Treat as approved request ready for processing
            db_req = MediaRequest(title=title, url=url, status="approved", requested_by=f"Discord: {username}")
            db.add(db_req)
            db.commit()
            
            return JSONResponse({"type": 4, "data": {"content": f"📥 Added and approved **{title}** to the queue."}})

        # Command: /scrape
        elif command_name == "scrape":
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

    return JSONResponse({"type": 4, "data": {"content": "Unknown command"}})
