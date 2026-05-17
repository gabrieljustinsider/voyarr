import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from database import get_db
from models import MediaRequest

router = APIRouter(prefix="/discord", tags=["discord"])
logger = logging.getLogger(__name__)


def verify_signature(request: Request, body: bytes):
    public_key = os.getenv("DISCORD_PUBLIC_KEY")
    if not public_key:
        # SECURITY: In a production environment, this should probably be required.
        # We will allow it for now but log a critical warning.
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

        if command_name == "request":
            options = command_data.get("options", [])
            title = None
            url = None
            for opt in options:
                if opt.get("name") == "title":
                    title = opt.get("value")
                elif opt.get("name") == "url":
                    url = opt.get("value")

            user_data = data.get("member", {}).get("user", {}) or data.get("user", {})
            username = user_data.get("username", "Unknown Discord User")

            if not title:
                return JSONResponse(
                    {
                        "type": 4,
                        "data": {"content": "Failed to create request: missing title."},
                    }
                )

            db_req = MediaRequest(
                title=title, url=url, requested_by=f"Discord: {username}"
            )
            db.add(db_req)
            db.commit()

            return JSONResponse(
                {
                    "type": 4,
                    "data": {
                        "content": f"✅ Successfully submitted media request for **{title}**."
                    },
                }
            )

    return JSONResponse({"type": 4, "data": {"content": "Unknown command"}})
