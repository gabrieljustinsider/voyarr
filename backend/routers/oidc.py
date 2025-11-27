import os
import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User, Settings, SsoLink
from security import create_access_token, get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["oidc"])

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Lazy-initialize OAuth to avoid import errors when authlib is not installed
_oauth = None


def _get_oauth():
    """Lazy-initialize the Authlib OAuth registry."""
    global _oauth
    if _oauth is None:
        try:
            from authlib.integrations.starlette_client import OAuth

            _oauth = OAuth()
            _oauth.register(
                name="oidc",
                client_id=os.getenv("OIDC_CLIENT_ID", ""),
                client_secret=os.getenv("OIDC_CLIENT_SECRET", ""),
                server_metadata_url=os.getenv("OIDC_DISCOVERY_URL", ""),
                client_kwargs={"scope": "openid email profile"},
            )
        except ImportError:
            logger.warning("authlib is not installed — OIDC routes will not function.")
            _oauth = None
    return _oauth


def is_oidc_enabled(db: Session) -> bool:
    """Checks the database settings table to see if the admin has enabled OIDC."""
    setting = db.query(Settings).filter(Settings.key == "oidc_enabled").first()
    if not setting:
        return False  # Disabled by default
    return setting.value.lower() == "true"


def _require_oidc(db: Session):
    """Guard that raises HTTP 400 if OIDC is disabled or not configured."""
    if not is_oidc_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC login is currently disabled by the administrator.",
        )
    oauth = _get_oauth()
    if oauth is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC is not available — authlib dependency is missing.",
        )
    client_id = os.getenv("OIDC_CLIENT_ID", "")
    discovery_url = os.getenv("OIDC_DISCOVERY_URL", "")
    if not client_id or not discovery_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC is enabled but not configured. Set OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_DISCOVERY_URL in your .env file.",
        )
    return oauth


@router.get("/login")
async def oidc_login(request: Request, db: Session = Depends(get_db)):
    """Initiates the OIDC authorization code flow by redirecting to the provider."""
    oauth = _require_oidc(db)
    redirect_uri = request.url_for("oidc_callback")
    return await oauth.oidc.authorize_redirect(request, str(redirect_uri))


@router.get("/callback")
async def oidc_callback(request: Request, db: Session = Depends(get_db)):
    """Handles the callback from the OIDC provider after user authorization."""
    oauth = _require_oidc(db)

    try:
        token = await oauth.oidc.authorize_access_token(request)
    except Exception as e:
        logger.error(f"OIDC token exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC authentication error: {str(e)}",
        )

    userinfo = token.get("userinfo")
    if not userinfo or not userinfo.get("email"):
        raise HTTPException(
            status_code=400,
            detail="Could not retrieve user email from OIDC provider.",
        )

    sub = userinfo.get("sub")
    if not sub:
        raise HTTPException(
            status_code=400,
            detail="OIDC provider did not return a 'sub' claim.",
        )

    email = userinfo["email"].lower().strip()
    preferred_username = userinfo.get("preferred_username") or email.split("@")[0]

    # Check if this external identity is already linked to a local user
    sso_link = db.query(SsoLink).filter(SsoLink.provider == "oidc", SsoLink.provider_user_id == str(sub)).first()
    
    user = db.query(User).filter(User.id == sso_link.user_id).first() if sso_link else None

    if not user:
        # Auto-provision a new user account
        random_pw = secrets.token_urlsafe(32)
        
        # If this is the very first user in the system, make them an admin
        user_count = db.query(User).count()
        assigned_role = "admin" if user_count == 0 else "user"
        
        # Prevent username collisions during auto-provisioning
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
                db.flush()  # Generate user ID for the link
                
                new_link = SsoLink(
                    user_id=user.id,
                    provider="oidc",
                    provider_user_id=str(sub),
                    email=email,
                )
                db.add(new_link)

                db.commit()
                db.refresh(user)
                break  # Successful provision
            except IntegrityError:
                db.rollback()
                base_username = f"{preferred_username}{suffix}"
                suffix += 1
                if attempt == max_retries - 1:
                    logger.error("Failed to auto-provision OIDC user: Max retries reached for username generation.")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to create user account due to database conflict.",
                    )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive.")

    # Generate JWT access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )

    # Redirect to the frontend with the token in the hash fragment for the SPA, and as a cookie
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    response = RedirectResponse(url=f"{frontend_url}/#access_token={access_token}")

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