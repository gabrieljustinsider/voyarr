from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os
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
)

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize global network configurations (proxies and user-agents)
from utils import initialize_network_settings

initialize_network_settings()

app = FastAPI(
    title="Voyarr API", version="1.12.0", root_path=os.getenv("ROOT_PATH", "")
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware to translate JWT to API Key for unified route protection
@app.middleware("http")
async def jwt_to_api_key_middleware(request: Request, call_next):
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
                    headers = dict(request.scope["headers"])
                    master_key = os.getenv("MASTER_KEY", "").encode()
                    headers[b"x-voyarr-api-key"] = master_key
                    request.scope["headers"] = [(k, v) for k, v in headers.items()]
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


@app.get("/")
async def root():
    return {"message": "Voyarr API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
