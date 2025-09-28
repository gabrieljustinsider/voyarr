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
                # SECURITY: Take the last IP in the chain to prevent client spoofing.
                # A malicious client can send "X-Forwarded-For: spoofed_ip", which the proxy
                # will append to, resulting in "spoofed_ip, real_ip".
                client_ip = forwarded.split(",")[-1].strip()

        # SECURITY: Rate limit on the route pattern (e.g. /api/{id}) instead of the raw URL path.
        # This prevents an attacker from exhausting Redis memory by spraying random path parameters.
        route_path = (
            request.scope.get("route").path
            if request.scope.get("route")
            else request.url.path
        )
        key = f"rate_limit:{client_ip}:{route_path}"

        try:
            # SECURITY: Use a transaction block and nx=True to ensure key creation and expiration
            # are completely atomic, eliminating race conditions and permanent orphaned keys.
            pipe = redis_client.pipeline(transaction=True)
            pipe.incr(key)
            pipe.expire(key, window_seconds, nx=True)
            results = await pipe.execute()
            current = results[0]

            if current > max_requests:
                raise HTTPException(
                    status_code=429, detail="Too many requests. Please slow down."
                )
        except aioredis.RedisError:
            pass  # Fail open if Redis is down so we don't block legitimate API traffic

    return dependency
