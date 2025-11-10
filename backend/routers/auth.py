from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import os
import secrets
from database import get_db
from models import User, Settings
import ipaddress
from security import (
    verify_password,
    get_password_hash,
    create_access_token,
    JWT_SECRET,
    ALGORITHM,
)
from datetime import timedelta
from pydantic import BaseModel, Field
from typing import Literal
from jose import jwt, JWTError
from rate_limiter import rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def create_user_session(user, response: Response):
    """Generate JWT access token and set HTTP-only session cookie for a user."""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
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
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}  # nosec B105


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    role: Literal["admin", "user", "viewer"] = "user"


@router.post(
    "/register", dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
def register_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    # SECURITY: Prevent unauthorized user registration
    user_count = db.query(User).count()
    if user_count > 0:
        api_key = request.headers.get("X-Voyarr-Api-Key")
        auth_header = request.headers.get("Authorization")

        is_authorized = False
        master_key_env = os.getenv("MASTER_KEY")
        if (
            api_key
            and master_key_env
            and secrets.compare_digest(api_key, master_key_env)
        ):
            is_authorized = True
        elif auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
                if payload.get("role") == "admin":
                    is_authorized = True
            except JWTError:
                pass

        if not is_authorized:
            raise HTTPException(
                status_code=403,
                detail="Only admins or master key holders can register new users.",
            )
    else:
        # Force the first user to be an admin to prevent system lockouts
        user.role = "admin"

    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username, password_hash=hashed_password, role=user.role
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already registered")
    return {
        "message": "User created successfully",
        "username": db_user.username,
        "role": db_user.role,
    }


@router.post(
    "/token", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    return create_user_session(user, response)


@router.post("/logout")
def logout(response: Response):
    """Clears the session cookie."""
    samesite = os.getenv("COOKIE_SAMESITE", "lax").lower()
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"

    response.delete_cookie(
        key="access_token", httponly=True, samesite=samesite, secure=secure
    )
    return {"message": "Logged out successfully"}


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    return user


@router.get("/config")
def get_auth_config(db: Session = Depends(get_db)):
    """Public endpoint returning active authentication policy flags for the login screen."""
    def get_bool_setting(key: str, default: bool) -> bool:
        setting = db.query(Settings).filter(Settings.key == key).first()
        if setting:
            return setting.value.lower() == "true"
        return default

    return {
        "passkeys_enabled": get_bool_setting("passkeys_enabled", True),
        "sso_enabled": get_bool_setting("sso_enabled", False),
        "oidc_enabled": get_bool_setting("oidc_enabled", False),
        "auth_bypass_enabled": get_bool_setting("auth_bypass_enabled", False),
        "auth_bypass_proxy_header_enabled": get_bool_setting("auth_bypass_proxy_header_enabled", False),
    }


@router.post("/autologin")
def autologin(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Evaluate authentication bypass criteria and auto-login if conditions are met."""
    def get_setting(key: str) -> str | None:
        setting = db.query(Settings).filter(Settings.key == key).first()
        return setting.value if setting else None

    # 1. Reverse Proxy Header Trust
    proxy_enabled = (get_setting("auth_bypass_proxy_header_enabled") or "").lower() == "true"
    if proxy_enabled:
        header_name = get_setting("auth_bypass_proxy_header_name") or "Remote-User"
        remote_user = request.headers.get(header_name)
        if remote_user:
            remote_user = remote_user.strip()
            user = db.query(User).filter(User.username == remote_user).first()
            if not user:
                # Auto-provision the user with a random secure password
                from security import get_password_hash
                random_pw = secrets.token_urlsafe(32)
                user = User(
                    username=remote_user,
                    password_hash=get_password_hash(random_pw),
                    role="user",
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            if user.is_active:
                result = create_user_session(user, response)
                result["username"] = user.username
                result["method"] = "proxy_header"
                return result

    # 2. Trusted Subnet Check
    subnet_enabled = (get_setting("auth_bypass_enabled") or "").lower() == "true"
    if subnet_enabled:
        subnets_str = get_setting("auth_bypass_subnets") or ""
        default_username = get_setting("auth_bypass_default_user") or ""
        if subnets_str and default_username:
            client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            if not client_ip and request.client:
                client_ip = request.client.host
            try:
                client_addr = ipaddress.ip_address(client_ip)
                trusted_subnets = [
                    s.strip() for s in subnets_str.split(",") if s.strip()
                ]
                is_trusted = False
                for subnet in trusted_subnets:
                    try:
                        network = ipaddress.ip_network(subnet, strict=False)
                        if client_addr in network:
                            is_trusted = True
                            break
                    except ValueError:
                        continue
                if is_trusted:
                    user = db.query(User).filter(User.username == default_username).first()
                    if user and user.is_active:
                        result = create_user_session(user, response)
                        result["username"] = user.username
                        result["method"] = "trusted_subnet"
                        return result
            except ValueError:
                pass  # Invalid IP address

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication bypass criteria not met.",
    )
