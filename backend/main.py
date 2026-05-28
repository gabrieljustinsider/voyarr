from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import Callable, Awaitable
from jose import jwt
from security import JWT_SECRET, ALGORITHM
from database import engine
from models import Base
from routers import (
    providers,
    credentials,
    progress,
    settings,
    library,
    duplicates,
    preferences,
    metadata,
    external_api,
    download,
    rules,
    schedules,
    backup,
    notifications,
    apikeys,
    cookies,
    transcode,
    auth,
    webhooks,
    requests,
    discord,
    chapters,
    favorites,
    user_stats,
    studios,
    analytics,
    live_streams,
    p2p,
    passkeys,
    sso,
    oidc,
    scraper,
    deovr,
)

# Database initialization with retry logic for container environments
import time
import logging
logger = logging.getLogger(__name__)

max_retries = 10
retry_delay = 3

for attempt in range(max_retries):
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)

        # Execute startup database migrations
        from db_utils import run_schema_migrations
        run_schema_migrations(engine)
        logger.info("Database initialized successfully.")
        break
    except Exception as e:
        err_msg = str(e)
        if "UniqueViolation" in err_msg or "duplicate key" in err_msg or "pg_type_typname_nsp_index" in err_msg:
            logger.warning(f"Database table creation race condition detected (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay}s...")
        else:
            logger.warning(f"Database connection failed (attempt {attempt + 1}/{max_retries}): {e}")
        if attempt < max_retries - 1:
            time.sleep(retry_delay)
        else:
            logger.error("Failed to connect to the database after maximum retries. Exiting.")
            import sys
            sys.exit(1)

# Initialize global network configurations (proxies and user-agents)
from utils import initialize_network_settings

initialize_network_settings()

app = FastAPI(
    title="Voyarr API", version="1.16.7", root_path=os.getenv("ROOT_PATH", "")
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware required for OIDC OAuth state management
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET)


# Middleware to translate JWT to API Key for unified route protection
@app.middleware("http")
async def jwt_to_api_key_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            if payload.get("sub"):
                role = payload.get("role", "viewer")
                path = request.url.path

                admin_routes = [
                    "/settings",
                    "/backup",
                    "/credentials",
                    "/schedules",
                    "/apikeys",
                    "/rules",
                    "/auth/register",
                    "/webhooks",
                    "/cookies",
                    "/logs",
                    "/transcode",
                ]
                is_admin_route = any(path.startswith(route) for route in admin_routes)

                is_allowed = False
                if role == "admin":
                    is_allowed = True
                elif role == "user" and not is_admin_route:
                    is_allowed = True
                    # Users shouldn't be able to alter providers or trigger full system scans
                    if request.method not in ["GET"] and any(
                        path.startswith(route)
                        for route in ["/providers", "/library/scan"]
                    ):
                        is_allowed = False
                elif (
                    role == "viewer" and request.method == "GET" and not is_admin_route
                ):
                    is_allowed = True

                if is_allowed:
                    # Security: Strip any incoming forged headers to prevent HTTP Header Spoofing
                    headers = [(k, v) for k, v in request.scope.get("headers", []) if k.lower() != b"x-voyarr-api-key"]
                    master_key = os.getenv("MASTER_KEY", "").encode()
                    headers.append((b"x-voyarr-api-key", master_key))
                    request.scope["headers"] = headers
                else:
                    from fastapi.responses import JSONResponse

                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "RBAC Forbidden: Your role is insufficient for this action."
                        },
                    )
        except Exception as e:
            print(f"RBAC error parsing JWT: {e}")
    return await call_next(request)


# Include Routers
app.include_router(providers.router)
app.include_router(credentials.router)
app.include_router(progress.router)
app.include_router(settings.router)
app.include_router(library.router)
app.include_router(duplicates.router)
app.include_router(preferences.router)
app.include_router(metadata.router)
app.include_router(external_api.router)
app.include_router(download.router)
app.include_router(rules.router)
app.include_router(schedules.router)
app.include_router(backup.router)
app.include_router(notifications.router)
app.include_router(apikeys.router)
app.include_router(cookies.router)
app.include_router(transcode.router)
app.include_router(auth.router)
app.include_router(webhooks.router)
app.include_router(requests.router)
app.include_router(discord.router)
app.include_router(chapters.router)
app.include_router(favorites.router)
app.include_router(user_stats.router)
app.include_router(studios.router)
app.include_router(analytics.router)
app.include_router(live_streams.router)
app.include_router(p2p.router)
app.include_router(passkeys.router)
app.include_router(sso.router)
app.include_router(oidc.router)
app.include_router(scraper.router)
app.include_router(deovr.router)


@app.get("/")
async def root():
    return {"message": "Voyarr API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
