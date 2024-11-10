import os
from fastapi import HTTPException, Request
import redis.asyncio as aioredis

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
# decode_responses=True ensures we get strings back from Redis instead of bytes
redis_client = aioredis.from_url(redis_url, decode_responses=True)

def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    async def dependency(request: Request):
        # Safely determine client IP. Do not trust X-Forwarded-For blindly to prevent spoofing bypasses.
        client_ip = request.client.host if request.client else "unknown"
        if os.getenv("TRUST_FORWARDED_FOR", "false").lower() == "true":
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
                
        key = f"rate_limit:{client_ip}:{request.url.path}"
        
        try:
            pipe = redis_client.pipeline()
            pipe.incr(key)
            results = await pipe.execute()
            current = results[0]
            
            if current == 1:
                await redis_client.expire(key, window_seconds)
            
            if current > max_requests:
                raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
        except aioredis.RedisError:
            pass # Fail open if Redis is down so we don't block legitimate API traffic
            
    return dependency