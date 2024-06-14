import os
import asyncio
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis
from dependencies import verify_api_key

router = APIRouter(prefix="/notifications", tags=["notifications"])

async def event_generator(request: Request):
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis_client = aioredis.from_url(redis_url)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("notifications")
    try:
        while True:
            if await request.is_disconnected():
                break
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = message['data'].decode('utf-8')
                yield f"data: {data}\n\n"
            await asyncio.sleep(0.1)
    finally:
        await pubsub.unsubscribe("notifications")
        await pubsub.close()
        await redis_client.close()

@router.get("/stream")
async def stream_notifications(request: Request, api_key: str = Depends(verify_api_key)):
    return StreamingResponse(event_generator(request), media_type="text/event-stream")
