from fastapi import FastAPI, Request, Response, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import Callable, Awaitable
from sqlalchemy.orm import Session
from jose import jwt
from security import JWT_SECRET, ALGORITHM
from contextlib import asynccontextmanager
from database import engine, get_db
from models import Base
from utils import get_version, initialize_network_settings
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
    error_logs,
    deovr,
    subscriptions,
    billers,
    scanner,
    performers_tags,
    logs,
    system_status,
)

# Database initialization with retry logic for container environments
import logging
from utils import get_primary_root

try:
    log_dir = os.path.join(get_primary_root(), "logs")
    os.makedirs(log_dir, exist_ok=True)
    fastapi_log_file = os.path.join(log_dir, "fastapi.log")
    file_handler = logging.FileHandler(fastapi_log_file)
    file_handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s in %(module)s: %(message)s"))
    root_log = logging.getLogger()
    root_log.setLevel(logging.INFO)
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', '') == os.path.abspath(fastapi_log_file) for h in root_log.handlers):
        root_log.addHandler(file_handler)
except Exception as log_init_err:
    print(f"Warning: Failed to setup file logger: {log_init_err}")

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
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

            # Seed default adult providers and subscription tiers if empty
            try:
                from seed_data import seed_default_data
                seed_default_data(engine)
            except Exception as seed_err:
                logger.error(f"Error executing database seed: {seed_err}")

            break
        except Exception as e:
            err_msg = str(e)
            if "UniqueViolation" in err_msg or "duplicate key" in err_msg or "pg_type_typname_nsp_index" in err_msg:
                logger.warning(f"Database table creation race condition detected (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay}s...")
            else:
                logger.warning(f"Database connection failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(retry_delay)
            else:
                logger.error("Failed to connect to the database after maximum retries. Exiting.")
                import sys
                sys.exit(1)

    initialize_network_settings()
    yield

app = FastAPI(
    title="Voyarr API", version=get_version(), root_path=os.getenv("ROOT_PATH", ""), lifespan=lifespan
)

# CORS
raw_origins = os.getenv("CORS_ORIGINS", "*").split(",")
allowed_origins = [o.strip() for o in raw_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"https?://.*" if "*" in allowed_origins else None,
    allow_credentials=True if "*" not in allowed_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error at {request.url.path}: {exc}", exc_info=True)
    try:
        import traceback
        from database import SessionLocal
        from models import ErrorLog
        from error_classifier import classify_error, prune_error_logs

        db = SessionLocal()
        tb = traceback.format_exc()
        msg = str(exc) or "Unhandled server error"
        classification = classify_error(msg, tb, 500)

        error_entry = ErrorLog(
            category=classification["category"],
            category_label=classification["category_label"],
            message=msg,
            user_friendly_explanation=classification["user_friendly_explanation"],
            source="backend",
            stack_trace=tb,
            path=request.url.path,
        )
        db.add(error_entry)
        db.commit()
        prune_error_logs(db)
        db.close()
    except Exception as log_err:
        logger.warning(f"Could not persist error log entry to DB: {log_err}")

    response = JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

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
                    master_key = os.getenv("MASTER_KEY", "voyarr-master-key-default-secret").encode()
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
app.include_router(error_logs.router)
app.include_router(scraper.parse_router)
app.include_router(scanner.router)
app.include_router(deovr.router)
app.include_router(subscriptions.router)
app.include_router(billers.router)
app.include_router(logs.router)
app.include_router(system_status.router)
app.include_router(performers_tags.router)


@app.get("/.well-known/webauthn")
async def webauthn_origin_association():
    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    return {
        "origins": cors_origins
    }


@app.get("/")
async def root(
    request: Request,
    api_key: str | None = Query(None),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
):
    user_agent = request.headers.get("user-agent", "").lower()
    is_deovr = "deovr" in user_agent or request.query_params.get("deovr") in ("1", "true")
    if is_deovr:
        from routers.deovr import deovr_index
        return deovr_index(request=request, api_key=api_key, token=token, search=None, studio=None, performer=None, tag=None, db=db)
    return {"message": "Voyarr API"}


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "healthy"}
