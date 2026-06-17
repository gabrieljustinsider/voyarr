import os
import logging
import secrets
import asyncio
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from jose import jwt, JWTError

from database import get_db
from models import User, Settings, SsoLink
from security import create_access_token, get_password_hash, JWT_SECRET, ALGORITHM

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["oidc"])

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Lazy-initialize OAuth to avoid import errors when authlib is not installed
_oauth = None


def _get_oauth():
    """Lazy-initialize the Authlib OAuth registry with all supported providers."""
    global _oauth
    if _oauth is None:
        try:
            from authlib.integrations.starlette_client import OAuth

            _oauth = OAuth()
            
            # 1. Custom OIDC
            _oauth.register(
                name="oidc",
                client_id=os.getenv("OIDC_CLIENT_ID", ""),
                client_secret=os.getenv("OIDC_CLIENT_SECRET", ""),
                server_metadata_url=os.getenv("OIDC_DISCOVERY_URL", ""),
                client_kwargs={"scope": "openid email profile"},
            )

            # 2. Google
            _oauth.register(
                name="google",
                client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
                client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
                server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
                client_kwargs={"scope": "openid email profile"},
            )

            # 3. GitHub
            _oauth.register(
                name="github",
                client_id=os.getenv("GITHUB_CLIENT_ID", ""),
                client_secret=os.getenv("GITHUB_CLIENT_SECRET", ""),
                api_base_url="https://api.github.com/",
                access_token_url="https://github.com/login/oauth/access_token",
                authorize_url="https://github.com/login/oauth/authorize",
                client_kwargs={"scope": "user:email"},
            )

            # 4. Discord
            _oauth.register(
                name="discord",
                client_id=os.getenv("DISCORD_CLIENT_ID", ""),
                client_secret=os.getenv("DISCORD_CLIENT_SECRET", ""),
                api_base_url="https://discord.com/api/",
                access_token_url="https://discord.com/api/oauth2/token",
                authorize_url="https://discord.com/api/oauth2/authorize",
                client_kwargs={"scope": "identify email"},
            )

        except ImportError:
            logger.warning("authlib is not installed — OIDC/SSO routes will not function.")
            _oauth = None
    return _oauth


def is_oidc_enabled(db: Session) -> bool:
    """Checks if the admin has enabled OIDC or SSO."""
    setting = db.query(Settings).filter(Settings.key == "sso_enabled").first()
    return setting and setting.value.lower() == "true"




def _require_oidc(db: Session, provider: str = "oidc"):
    """Guard that raises HTTP 400 if OIDC/SSO is disabled or not configured."""
    setting = db.query(Settings).filter(Settings.key == "sso_enabled").first()
    sso_enabled = setting and setting.value.lower() == "true"

    if provider == "oidc":
        # Custom OIDC configuration setting check
        setting_oidc = db.query(Settings).filter(Settings.key == "oidc_enabled").first()
        if not setting_oidc or setting_oidc.value.lower() != "true":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OIDC login is currently disabled by the administrator.",
            )
    elif not sso_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO login is currently disabled by the administrator.",
        )

    oauth = _get_oauth()
    if oauth is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SSO/OIDC is not available — authlib dependency is missing.",
        )

    # Validate environment credentials configuration
    if provider == "oidc":
        client_id = os.getenv("OIDC_CLIENT_ID", "")
        discovery_url = os.getenv("OIDC_DISCOVERY_URL", "")
        if not client_id or not discovery_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OIDC is enabled but not configured. Set OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_DISCOVERY_URL in your .env file.",
            )
    elif provider == "google":
        client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google SSO is enabled but GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment.",
            )
    elif provider == "github":
        client_id = os.getenv("GITHUB_CLIENT_ID", "")
        client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GitHub SSO is enabled but GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing from environment.",
            )
    elif provider == "discord":
        client_id = os.getenv("DISCORD_CLIENT_ID", "")
        client_secret = os.getenv("DISCORD_CLIENT_SECRET", "")
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Discord SSO is enabled but DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is missing from environment.",
            )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown SSO provider: {provider}")

    return oauth


def _process_oidc_user(
    db: Session,
    provider: str,
    sub: str,
    email: str,
    username_suggest: str,
    auth_header: Optional[str],
    access_token_cookie: Optional[str],
    frontend_url: str,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None
):
    """Synchronous worker offloaded to thread to process database linking without blocking the async event loop."""
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        token = access_token_cookie

    current_user = None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username:
                current_user = db.query(User).filter(User.username == username).first()
        except JWTError:
            pass

    if current_user:
        existing_link = db.query(SsoLink).filter(SsoLink.provider == provider, SsoLink.provider_user_id == sub).first()
        if existing_link:
            if existing_link.user_id != current_user.id:
                return f"{frontend_url}/#error=This {provider} account is already linked to another Voyarr user.", None
            
            # Update email and avatar_url if updated/provided
            existing_link.email = email
            existing_link.avatar_url = avatar_url
            db.commit()
            return f"{frontend_url}/#message={provider.capitalize()} is already linked to your account.", None

        user_existing = db.query(SsoLink).filter(SsoLink.user_id == current_user.id, SsoLink.provider == provider).first()
        if user_existing:
            return f"{frontend_url}/#error=Your account is already linked to a {provider.capitalize()} account.", None

        new_link = SsoLink(
            user_id=current_user.id,
            provider=provider,
            provider_user_id=sub,
            email=email,
            avatar_url=avatar_url
        )
        db.add(new_link)
        db.commit()
        return f"{frontend_url}/#message=Successfully linked {provider.capitalize()} account!", None

    # Standard Login/Auto-provisioning flow
    sso_link = db.query(SsoLink).filter(SsoLink.provider == provider, SsoLink.provider_user_id == sub).first()
    user = db.query(User).filter(User.id == sso_link.user_id).first() if sso_link else None

    if not user:
        # Auto-provision new user account
        random_pw = secrets.token_urlsafe(32)
        user_count = db.query(User).count()
        assigned_role = "admin" if user_count == 0 else "user"
        
        preferred_username = username_suggest or (email.split("@")[0] if email else f"{provider}_{sub}")
        base_username = preferred_username
        suffix = 1
        
        max_retries = 5
        for attempt in range(max_retries):
            while db.query(User).filter(User.username == base_username).first():
                base_username = f"{preferred_username}{suffix}"
                suffix += 1

            user = User(
                username=base_username,
                password_hash=get_password_hash(random_pw),
                role=assigned_role,
            )
            db.add(user)
            try:
                db.flush()
                
                new_link = SsoLink(
                    user_id=user.id,
                    provider=provider,
                    provider_user_id=sub,
                    email=email,
                    avatar_url=avatar_url
                )
                db.add(new_link)
                db.commit()
                db.refresh(user)
                break
            except IntegrityError:
                db.rollback()
                base_username = f"{preferred_username}{suffix}"
                suffix += 1
                if attempt == max_retries - 1:
                    logger.error("Failed to auto-provision user: Max retries reached.")
                    raise HTTPException(status_code=500, detail="Failed to create user account.")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive.")

    from routers.auth import update_user_last_login
    update_user_last_login(db, user)

    # Generate access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )

    return f"{frontend_url}/#access_token={access_token}", access_token


@router.get("/login")
async def oidc_login(request: Request, provider: str = "oidc", token: Optional[str] = None, db: Session = Depends(get_db)):
    """Initiates the OIDC/SSO authorization code flow by redirecting to the provider."""
    oauth = await asyncio.to_thread(_require_oidc, db, provider)
    
    client = getattr(oauth, provider, None)
    if not client:
        raise HTTPException(status_code=400, detail=f"Provider '{provider}' is not supported.")

    redirect_uri = request.url_for("oidc_callback")
    if request.headers.get("x-forwarded-proto") == "https":
        redirect_uri = redirect_uri.replace(scheme="https")
    redirect_uri = f"{redirect_uri}?provider={provider}"

    response = await client.authorize_redirect(request, redirect_uri)

    # Store user access token if linking from settings
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            samesite = os.getenv("COOKIE_SAMESITE", "lax").lower()
            secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
            response.set_cookie(
                key="access_token",
                value=token,
                httponly=True,
                max_age=600,  # 10 minutes temporary session cookie
                samesite=samesite,
                secure=secure,
            )
        except Exception as e:
            logger.error(f"Invalid link token provided: {e}")

    return response


@router.get("/callback")
async def oidc_callback(request: Request, provider: str = "oidc", db: Session = Depends(get_db)):
    """Handles the callback from the OIDC/OAuth provider after user authorization."""
    oauth = await asyncio.to_thread(_require_oidc, db, provider)
    
    redirect_uri = request.url_for("oidc_callback")
    if request.headers.get("x-forwarded-proto") == "https":
        redirect_uri = redirect_uri.replace(scheme="https")
    redirect_uri = f"{redirect_uri}?provider={provider}"

    client = getattr(oauth, provider, None)
    if not client:
        raise HTTPException(status_code=400, detail=f"Provider '{provider}' is not supported.")

    try:
        token = await client.authorize_access_token(request, redirect_uri=str(redirect_uri))
    except Exception as e:
        logger.error(f"{provider} token exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{provider} authentication error: {str(e)}",
        )

    email = None
    sub = None
    username_suggest = None
    display_name = None
    avatar_url = None

    if provider in ("oidc", "google"):
        userinfo = token.get("userinfo")
        if not userinfo:
            try:
                userinfo = await client.userinfo(token=token)
            except Exception:
                pass
        if userinfo:
            email = userinfo.get("email")
            sub = userinfo.get("sub")
            username_suggest = userinfo.get("preferred_username") or userinfo.get("name")
            display_name = userinfo.get("name")
            avatar_url = userinfo.get("picture")
    
    elif provider == "github":
        try:
            resp = await client.get("user", token=token)
            user_data = resp.json()
            sub = str(user_data.get("id"))
            username_suggest = user_data.get("login")
            email = user_data.get("email")
            display_name = user_data.get("name")
            avatar_url = user_data.get("avatar_url")
            if not email:
                email_resp = await client.get("user/emails", token=token)
                emails = email_resp.json()
                primary_email = next((e["email"] for e in emails if e.get("primary")), None)
                email = primary_email or (emails[0]["email"] if emails else None)
        except Exception as e:
            logger.error(f"Failed to fetch GitHub user info: {e}")
            raise HTTPException(status_code=400, detail="Could not retrieve user details from GitHub.")

    elif provider == "discord":
        try:
            resp = await client.get("users/@me", token=token)
            user_data = resp.json()
            sub = str(user_data.get("id"))
            username_suggest = user_data.get("username")
            email = user_data.get("email")
            display_name = user_data.get("global_name") or user_data.get("username")
            avatar_hash = user_data.get("avatar")
            if avatar_hash:
                avatar_url = f"https://cdn.discordapp.com/avatars/{sub}/{avatar_hash}.png"
        except Exception as e:
            logger.error(f"Failed to fetch Discord user info: {e}")
            raise HTTPException(status_code=400, detail="Could not retrieve user details from Discord.")

    if not sub:
        raise HTTPException(status_code=400, detail="Could not retrieve unique identifier (sub/id) from provider.")

    if email:
        email = email.lower().strip()
    else:
        email = f"{username_suggest or sub}@{provider}.local"

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    # Offload synchronous database provisioning logic to background thread
    auth_header = request.headers.get("Authorization")
    access_token_cookie = request.cookies.get("access_token")

    redirect_url, access_token = await asyncio.to_thread(
        _process_oidc_user,
        db, provider, str(sub), email, username_suggest,
        auth_header, access_token_cookie, frontend_url,
        display_name, avatar_url
    )

    response = RedirectResponse(url=redirect_url)

    if access_token:
        samesite = os.getenv("COOKIE_SAMESITE", "lax").lower()
        secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            expires=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite=samesite,
            secure=secure,
        )

    return response