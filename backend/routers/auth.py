from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import os
import secrets
import hashlib
from database import get_db
from models import User, Settings, ApiKey
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
from typing import Literal, Any, Optional
from jose import jwt, JWTError
from rate_limiter import rate_limit
from dependencies import verify_api_key

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

DEFAULT_PERMISSIONS = {
    "library": "view",
    "streaming": "view",
    "scraping": "none",
    "ripping": "none",
    "requests": "view",
    "settings": "none",
    "billing": "none",
    "providers": "none",
    "lens_access": "none",
    "lens_features": "none"
}


def update_user_last_login(db: Session, user: User) -> None:
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    db.commit()


def get_daily_rip_usage(db: Session, user_id: str) -> int:
    from sqlalchemy import func
    from datetime import datetime, timezone
    from models import DownloadQueue, MassRipSession
    today = datetime.now(timezone.utc).date()
    dq_count = db.query(DownloadQueue).filter(
        DownloadQueue.user_id == user_id,
        func.date(DownloadQueue.created_at) == today
    ).count()
    mr_count = db.query(MassRipSession).filter(
        MassRipSession.user_id == user_id,
        func.date(MassRipSession.created_at) == today
    ).count()
    return dq_count + mr_count


def create_user_session(user: User, response: Response) -> dict[str, str]:
    """Generate JWT access token and set HTTP-only session cookie for a user."""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.username), "role": str(user.role)},
        expires_delta=access_token_expires,
    )
    samesite_env = os.getenv("COOKIE_SAMESITE", "lax").lower()
    samesite: Literal["lax", "strict", "none"] = "lax"
    if samesite_env in ("lax", "strict", "none"):
        samesite = samesite_env  # type: ignore
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
    return {"access_token": access_token, "token_type": "bearer", "role": str(user.role)}  # nosec B105


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    role: Literal["admin", "user", "viewer"] = "user"


@router.post(
    "/register", dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
def register_user(user: UserCreate, request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
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

    if db.query(User).filter(func.lower(User.username) == user.username.lower()).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username, password_hash=hashed_password, role=user.role
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        
        # Log administrative registration action
        actor_username = "System (First User)"
        actor_id: str | None = None
        if user_count > 0:
            api_key = request.headers.get("X-Voyarr-Api-Key")
            auth_header = request.headers.get("Authorization")
            master_key_env = os.getenv("MASTER_KEY")
            if api_key and master_key_env and secrets.compare_digest(api_key, master_key_env):
                actor_username = "Master Key"
            elif auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
                    actor_username = str(payload.get("sub") or "Admin User")
                    actor_user = db.query(User).filter(func.lower(User.username) == actor_username.lower()).first()
                    if actor_user:
                        actor_id = str(actor_user.id)
                except Exception:
                    actor_username = "Admin User"
                    
        from db_utils import log_admin_action
        log_admin_action(
            db,
            admin_id=actor_id,
            admin_username=actor_username,
            action="register_user",
            details={
                "created_user_id": str(db_user.id),
                "created_username": str(db_user.username),
                "role": str(db_user.role)
            }
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already registered")
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Database write failed. Check your system folder permissions (PUID/PGID). Error: {str(e)}"
        )
    return {
        "message": "User created successfully",
        "username": str(db_user.username),
        "role": str(db_user.role),
    }


@router.post(
    "/token", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.query(User).filter(func.lower(User.username) == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not bool(user.is_active):
        raise HTTPException(status_code=400, detail="Inactive user account")

    update_user_last_login(db, user)
    return create_user_session(user, response)


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    """Clears the session cookie."""
    samesite_env = os.getenv("COOKIE_SAMESITE", "lax").lower()
    samesite: Literal["lax", "strict", "none"] = "lax"
    if samesite_env in ("lax", "strict", "none"):
        samesite = samesite_env  # type: ignore
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"

    response.delete_cookie(
        key="access_token", httponly=True, samesite=samesite, secure=secure
    )
    return {"message": "Logged out successfully"}


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)),
    x_voyarr_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Check for JWT token in Authorization header, OAuth2 scheme parameter, or Cookie
    jwt_token = token
    if not jwt_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            jwt_token = auth_header.split(" ")[1]
    if not jwt_token:
        jwt_token = request.cookies.get("access_token")
    if not jwt_token:
        jwt_token = request.query_params.get("token")
        
    if jwt_token:
        try:
            payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[ALGORITHM])
            sub = payload.get("sub")
            if sub and isinstance(sub, str):
                user = db.query(User).filter(User.username == sub).first()
                if user and bool(user.is_active):
                    return user
        except JWTError:
            pass

    # 2. Check for Master API Key or Query API Key fallback
    provided_key = x_voyarr_api_key or request.query_params.get("api_key")
    expected_key = os.getenv("MASTER_KEY", "voyarr-master-key-default-secret")
    if provided_key and secrets.compare_digest(provided_key, expected_key):
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = db.query(User).first()
        if admin_user:
            return admin_user
        return User(id="00000000-0000-0000-0000-000000000000", username="admin", role="admin", is_active=True)

    # 3. Check for scoped/pairing API keys (used by companion extensions and VR headset pairing)
    if provided_key:
        hashed_key = hashlib.sha256(provided_key.encode()).hexdigest()
        db_key = db.query(ApiKey).filter(ApiKey.key_hash == hashed_key).first()
        if db_key:
            user = db.query(User).filter(User.id == db_key.user_id).first()
            if user:
                db_key.last_used = func.current_timestamp()
                db.commit()
                return user

    raise credentials_exception


@router.get("/config")
def get_auth_config(db: Session = Depends(get_db)):
    """Public endpoint returning active authentication policy flags for the login screen."""
    def get_bool_setting(key: str, default: bool) -> bool:
        setting = db.query(Settings).filter(Settings.key == key).first()
        if setting:
            return setting.value.lower() == "true"
        return default

    return {
        "has_users": db.query(User).count() > 0,
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
) -> dict[str, Any]:
    """Evaluate authentication bypass criteria and auto-login if conditions are met."""
    def get_setting(key: str) -> str | None:
        setting = db.query(Settings).filter(Settings.key == key).first()
        return str(setting.value) if setting and setting.value is not None else None  # type: ignore

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
            if bool(user.is_active):
                result = create_user_session(user, response)
                result["username"] = str(user.username)
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
                    if user and bool(user.is_active):
                        result = create_user_session(user, response)
                        result["username"] = str(user.username)
                        result["method"] = "trusted_subnet"
                        return result
            except ValueError:
                pass  # Invalid IP address

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication bypass criteria not met.",
    )


class UserPermissionsUpdate(BaseModel):
    role: str
    permissions: dict[str, Any]


@router.get("/users")
def list_users(
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    if auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
    elif auth_info.get("type") != "master_key":
        raise HTTPException(status_code=403, detail="Forbidden")

    users = db.query(User).all()
    return [
        {
            "id": str(u.id),
            "username": str(u.username),
            "role": str(u.role),
            "is_active": bool(u.is_active),
            "created_at": u.created_at,
            "permissions": u.permissions or DEFAULT_PERMISSIONS
        }
        for u in users
    ]


@router.put("/users/{user_id}/permissions")
def update_user_permissions(
    user_id: str,
    payload: UserPermissionsUpdate,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
) -> dict[str, str]:
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Lockout protection: prevent downgrading the last admin in the system
    if str(target_user.role) == "admin" and payload.role != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Lockout Protection: Cannot downgrade the sole administrator account to prevent complete system lockout."
            )

    old_role = str(target_user.role)
    old_permissions = target_user.permissions or DEFAULT_PERMISSIONS

    target_user.role = payload.role  # type: ignore
    target_user.permissions = payload.permissions  # type: ignore
    db.commit()
    db.refresh(target_user)

    # Log admin action
    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="update_user_permissions",
        details={
            "target_user_id": str(target_user.id),
            "target_username": str(target_user.username),
            "old_role": old_role,
            "new_role": payload.role,
            "old_permissions": old_permissions,
            "new_permissions": payload.permissions
        }
    )
    return {"message": "User permissions and role updated successfully"}


@router.get("/admin-logs")
def list_admin_logs(
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    if auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
    elif auth_info.get("type") != "master_key":
        raise HTTPException(status_code=403, detail="Forbidden")

    from models import AdminLog
    logs = db.query(AdminLog).order_by(AdminLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id": int(log.id) if log.id is not None else None,  # type: ignore
            "admin_id": str(log.admin_id) if log.admin_id is not None else None,  # type: ignore
            "admin_username": str(log.admin_username),
            "action": str(log.action),
            "details": log.details,
            "timestamp": log.timestamp
        }
        for log in logs
    ]


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Change the password of the currently authenticated user."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not user.password_hash or not verify_password(req.current_password, str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    
    hashed_password = get_password_hash(req.new_password)
    user.password_hash = hashed_password
    db.commit()

    if user.role == "admin":
        from db_utils import log_admin_action
        log_admin_action(
            db,
            admin_id=str(user.id),
            admin_username=str(user.username),
            action="change_password",
            details={"user_id": str(user.id), "username": str(user.username)}
        )
        
    return {"message": "Password changed successfully"}


# Admin User Management Schemas & Routes

class UserUpdatePayload(BaseModel):
    username: str
    role: str
    is_active: bool
    permissions: dict[str, Any]


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


class MergeUsersRequest(BaseModel):
    source_user_id: str
    target_user_id: str


@router.get("/users/{user_id}")
def get_user_details(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    if auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
    elif auth_info.get("type") != "master_key":
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch enrolled passkeys
    from models import Passkey
    passkeys = db.query(Passkey).filter(Passkey.user_id == user_id).all()
    passkeys_list = [
        {
            "id": pk.id,
            "name": pk.name,
            "created_at": pk.created_at,
            "last_used_at": pk.last_used_at,
            "ip_address": pk.ip_address,
            "location": pk.location,
            "browser": pk.browser,
            "os_name": pk.os_name,
            "backup_eligible": pk.backup_eligible,
            "backup_state": pk.backup_state
        }
        for pk in passkeys
    ]

    # Fetch connected SSO links
    from models import SsoLink
    sso_links = db.query(SsoLink).filter(SsoLink.user_id == user_id).all()
    sso_list = [
        {
            "id": sso.id,
            "provider": sso.provider,
            "email": sso.email,
            "avatar_url": getattr(sso, "avatar_url", None),
            "linked_at": sso.linked_at
        }
        for sso in sso_links
    ]

    # Database-agnostic log filtration (avoids vendor-locked SQL operations)
    try:
        from models import AdminLog
        all_logs = db.query(AdminLog).order_by(AdminLog.timestamp.desc()).all()
        filtered_logs = []
        for log in all_logs:
            details = log.details
            if isinstance(details, str):
                try:
                    import json
                    details = json.loads(details)
                except Exception:
                    details = {}
            if not isinstance(details, dict):
                details = {}

            if (str(log.admin_id or "") == str(user_id) or 
                str(details.get("target_user_id") or "") == str(user_id) or 
                str(details.get("user_id") or "") == str(user_id) or 
                str(details.get("created_user_id") or "") == str(user_id)):
                filtered_logs.append({
                    "id": log.id,
                    "admin_username": log.admin_username,
                    "action": log.action,
                    "details": details,
                    "timestamp": log.timestamp
                })
                if len(filtered_logs) >= 200:
                    break
    except Exception:
        filtered_logs = []

    try:
        daily_rip_usage = get_daily_rip_usage(db, str(user.id))
    except Exception:
        daily_rip_usage = 0

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "permissions": user.permissions or DEFAULT_PERMISSIONS,
        "daily_rip_usage": daily_rip_usage,
        "passkeys": passkeys_list,
        "sso_links": sso_list,
        "activity_logs": filtered_logs
    }


@router.post("/users")
def admin_create_user(
    payload: UserCreate,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(payload.password)
    db_user = User(
        username=payload.username,
        password_hash=hashed_password,
        role=payload.role,
        is_active=True,
        permissions=DEFAULT_PERMISSIONS
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_create_user",
        details={"created_user_id": db_user.id, "created_username": db_user.username, "role": db_user.role}
    )

    return {
        "id": db_user.id,
        "username": db_user.username,
        "role": db_user.role,
        "is_active": db_user.is_active,
        "created_at": db_user.created_at,
        "permissions": db_user.permissions
    }


@router.put("/users/{user_id}")
def admin_update_user(
    user_id: str,
    payload: UserUpdatePayload,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Lockout protection: prevent downgrading the last admin
    if str(target_user.role) == "admin" and payload.role != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Lockout Protection: Cannot downgrade the sole administrator account to prevent complete system lockout."
            )

    # Check duplicate username
    if payload.username != target_user.username:
        dup = db.query(User).filter(User.username == payload.username).first()
        if dup:
            raise HTTPException(status_code=400, detail="Username already in use")

    old_username = target_user.username
    old_role = target_user.role
    old_permissions = target_user.permissions
    old_active = target_user.is_active

    target_user.username = payload.username
    target_user.role = payload.role
    target_user.is_active = payload.is_active
    target_user.permissions = payload.permissions
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_update_user",
        details={
            "target_user_id": user_id,
            "old_username": old_username,
            "new_username": payload.username,
            "old_role": old_role,
            "new_role": payload.role,
            "old_permissions": old_permissions,
            "new_permissions": payload.permissions,
            "old_active": old_active,
            "new_active": payload.is_active
        }
    )
    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Lockout protection
    if str(target_user.role) == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Lockout Protection: Cannot delete the sole administrator account.")

    username = target_user.username
    db.delete(target_user)
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_delete_user",
        details={"target_user_id": user_id, "target_username": username}
    )
    return {"message": f"User '{username}' deleted successfully"}


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str,
    req: ResetPasswordRequest,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.password_hash = get_password_hash(req.new_password)
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_reset_password",
        details={"target_user_id": user_id, "target_username": target_user.username}
    )
    return {"message": "Password reset successfully"}


@router.post("/users/{user_id}/reset-mfa")
def admin_reset_mfa(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from models import Passkey
    deleted_count = db.query(Passkey).filter(Passkey.user_id == user_id).delete()
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_reset_mfa",
        details={"target_user_id": user_id, "target_username": target_user.username, "revoked_count": deleted_count}
    )
    return {"message": f"Successfully revoked {deleted_count} enrolled passkey(s)"}


@router.post("/users/{user_id}/reset-sso")
def admin_reset_sso(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from models import SsoLink
    deleted_count = db.query(SsoLink).filter(SsoLink.user_id == user_id).delete()
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_reset_sso",
        details={"target_user_id": user_id, "target_username": target_user.username, "deleted_count": deleted_count}
    )
    return {"message": f"Successfully unlinked {deleted_count} SSO provider connection(s)"}


@router.post("/users/{user_id}/revoke-sessions")
def admin_revoke_sessions(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    """Revoke all active paired API keys and session credentials for a user."""
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from models import ApiKey
    deleted_keys = db.query(ApiKey).filter(ApiKey.user_id == user_id).delete()
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="admin_revoke_user_sessions",
        details={"target_user_id": user_id, "target_username": target_user.username, "keys_revoked": deleted_keys}
    )
    return {"message": f"Successfully revoked all active sessions & {deleted_keys} API keys for {target_user.username}"}


@router.post("/users/{user_id}/toggle-lock")
def admin_toggle_lock(
    user_id: str,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    """Toggle user active / frozen state (lock or unlock user account)."""
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.is_active = not target_user.is_active
    db.commit()
    db.refresh(target_user)

    from db_utils import log_admin_action
    action = "admin_unlock_user" if target_user.is_active else "admin_lock_user"
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action=action,
        details={"target_user_id": user_id, "target_username": target_user.username, "is_active": target_user.is_active}
    )
    status_str = "unlocked and enabled" if target_user.is_active else "locked and disabled"
    return {"message": f"User account '{target_user.username}' has been {status_str}", "is_active": target_user.is_active}


@router.post("/users/merge")
def admin_merge_users(
    req: MergeUsersRequest,
    auth_info: dict[str, Any] = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    actor_username = "Unknown"
    actor_id: str | None = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        if auth_info.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        actor_username = str(auth_info.get("user") or "Admin User")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = str(actor_user.id)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    source_user = db.query(User).filter(User.id == req.source_user_id).first()
    target_user = db.query(User).filter(User.id == req.target_user_id).first()

    if not source_user or not target_user:
        raise HTTPException(status_code=404, detail="One or both users not found")

    if source_user.id == target_user.id:
        raise HTTPException(status_code=400, detail="Cannot merge a user into themselves")

    # Lockout protection
    if str(source_user.role) == "admin" and str(target_user.role) != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Lockout Protection: Cannot merge/delete the sole admin user.")

    # 1. Update media requests (username string based)
    from models import MediaRequest, AdminLog, UserVideoStats, Favorite, UserHistory, NotificationPreference, NotificationLog, UserPreference, Passkey, SsoLink
    db.query(MediaRequest).filter(MediaRequest.requested_by == source_user.username).update(
        {MediaRequest.requested_by: target_user.username}, synchronize_session=False
    )

    # 2. Update admin logs (username & id)
    db.query(AdminLog).filter(AdminLog.admin_id == source_user.id).update(
        {AdminLog.admin_id: target_user.id, AdminLog.admin_username: target_user.username}, synchronize_session=False
    )

    # 3. Update playback history
    db.query(UserHistory).filter(UserHistory.user_id == source_user.id).update(
        {UserHistory.user_id: target_user.id}, synchronize_session=False
    )

    # 4. Reconcile user video stats
    source_stats = db.query(UserVideoStats).filter(UserVideoStats.user_id == source_user.id).all()
    for stat in source_stats:
        target_stat = db.query(UserVideoStats).filter(
            (UserVideoStats.user_id == target_user.id) & 
            (UserVideoStats.library_entry_id == stat.library_entry_id)
        ).first()
        if target_stat:
            target_stat.play_count = (target_stat.play_count or 0) + (stat.play_count or 0)
            target_stat.watched_duration = max(target_stat.watched_duration or 0, stat.watched_duration or 0)
            db.delete(stat)
        else:
            stat.user_id = target_user.id

    # 5. Reconcile favorites
    source_favorites = db.query(Favorite).filter(Favorite.user_id == source_user.id).all()
    for fav in source_favorites:
        target_fav = db.query(Favorite).filter(
            (Favorite.user_id == target_user.id) & 
            (Favorite.item_type == fav.item_type) & 
            (Favorite.item_id == fav.item_id)
        ).first()
        if target_fav:
            db.delete(fav)
        else:
            fav.user_id = target_user.id

    # 6. Reassign enrolled auth credentials
    db.query(Passkey).filter(Passkey.user_id == source_user.id).update(
        {Passkey.user_id: target_user.id}, synchronize_session=False
    )
    db.query(SsoLink).filter(SsoLink.user_id == source_user.id).update(
        {SsoLink.user_id: target_user.id}, synchronize_session=False
    )

    # 7. Reassign notification logs & delete redundant configurations
    db.query(NotificationLog).filter(NotificationLog.user_id == source_user.id).update(
        {NotificationLog.user_id: target_user.id}, synchronize_session=False
    )
    db.query(NotificationPreference).filter(NotificationPreference.user_id == source_user.id).delete()
    db.query(UserPreference).filter(UserPreference.user_id == source_user.id).delete()

    # 8. Delete source user
    db.delete(source_user)
    db.commit()

    from db_utils import log_admin_action
    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="merge_users",
        details={
            "source_user_id": req.source_user_id,
            "source_username": source_user.username,
            "target_user_id": req.target_user_id,
            "target_username": target_user.username
        }
    )

    return {"message": f"Successfully merged user '{source_user.username}' into '{target_user.username}'"}


@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import Passkey, SsoLink
    
    # Fetch passkeys
    passkeys_list = []
    try:
        passkeys = db.query(Passkey).filter(Passkey.user_id == current_user.id).all()
        passkeys_list = [
            {"id": pk.id, "name": pk.name, "created_at": pk.created_at}
            for pk in passkeys
        ]
    except Exception as e:
        logger.warning(f"Error querying passkeys for user {current_user.id}: {e}")

    # Fetch SSO links
    sso_list = []
    try:
        sso_links = db.query(SsoLink).filter(SsoLink.user_id == current_user.id).all()
        sso_list = [
            {"id": sso.id, "provider": sso.provider, "email": sso.email, "avatar_url": getattr(sso, "avatar_url", None)}
            for sso in sso_links
        ]
    except Exception as e:
        logger.warning(f"Error querying SSO links for user {current_user.id}: {e}")

    daily_rip_usage = 0
    try:
        daily_rip_usage = get_daily_rip_usage(db, str(current_user.id))
    except Exception as e:
        logger.warning(f"Error getting daily rip usage for user {current_user.id}: {e}")

    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at,
        "permissions": current_user.permissions or DEFAULT_PERMISSIONS,
        "daily_rip_usage": daily_rip_usage,
        "passkeys": passkeys_list,
        "sso_links": sso_list,
        "display_name": getattr(current_user, "display_name", None),
        "email": getattr(current_user, "email", None),
        "avatar_url": getattr(current_user, "avatar_url", None),
        "locale": getattr(current_user, "locale", "en"),
        "date_format": getattr(current_user, "date_format", "YYYY-MM-DD"),
        "time_format": getattr(current_user, "time_format", "HH:mm:ss"),
        "timezone": getattr(current_user, "timezone", "UTC")
    }


class ProfileUpdatePayload(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: Optional[str] = "en"
    date_format: Optional[str] = "YYYY-MM-DD"
    time_format: Optional[str] = "HH:mm:ss"
    timezone: Optional[str] = "UTC"


@router.put("/users/me/profile")
def update_own_profile(
    payload: ProfileUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.display_name = payload.display_name
    current_user.email = payload.email
    current_user.avatar_url = payload.avatar_url
    current_user.locale = payload.locale or "en"
    current_user.date_format = payload.date_format or "YYYY-MM-DD"
    current_user.time_format = payload.time_format or "HH:mm:ss"
    current_user.timezone = payload.timezone or "UTC"
    db.commit()
    return {"message": "Profile updated successfully"}


import time
from hashlib import sha256

PENDING_PAIRINGS = {}  # pairing_code -> {"key_hash": str, "raw_key": str, "expires_at": float}


class PairConfirmRequest(BaseModel):
    pairing_code: str


@router.post("/pair/initiate")
def initiate_pairing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiates a secure pairing flow for Voyarr Lens.
    Requires user to be logged in. Generates a 6-digit numeric pairing code.
    """
    # Generate user-friendly 6-digit code
    pairing_code = "".join(secrets.choice("0123456789") for _ in range(6))
    
    # Pre-generate a secure API key
    raw_key = f"vyr_lens_{secrets.token_urlsafe(32)}"
    key_hash = sha256(raw_key.encode()).hexdigest()
    
    # Store with a 5-minute expiry
    PENDING_PAIRINGS[pairing_code] = {
        "key_hash": key_hash,
        "raw_key": raw_key,
        "expires_at": time.time() + 300,
        "user_id": current_user.id
    }
    
    return {"pairing_code": pairing_code, "expires_in": 300}


@router.post("/pair/confirm")
def confirm_pairing(
    req: PairConfirmRequest,
    db: Session = Depends(get_db)
):
    """
    Confirmed by the extension.
    Verifies the pairing code, registers the API key, and returns the raw key.
    """
    code = req.pairing_code.strip()
    
    # Clean up expired entries
    now = time.time()
    expired = [k for k, v in PENDING_PAIRINGS.items() if v["expires_at"] < now]
    for k in expired:
        PENDING_PAIRINGS.pop(k, None)
        
    if code not in PENDING_PAIRINGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired pairing code."
        )
        
    pairing_data = PENDING_PAIRINGS.pop(code)
    
    from models import ApiKey
    
    new_key = ApiKey(
        name="Voyarr Lens Companion (Paired)",
        key_hash=pairing_data["key_hash"],
        user_id=pairing_data.get("user_id"),
        is_pairing=True
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return {
        "status": "success",
        "raw_key": pairing_data["raw_key"]
    }


DEVICE_PAIRING_STORE = {}  # device_code -> {"user_code": str, "status": "pending"|"approved", "expires_at": float, "user_id": int|None, "raw_key": str|None, "key_hash": str|None}

class DeviceApproveRequest(BaseModel):
    user_code: str
    device_name: str | None = "VR Headset"

class DevicePollRequest(BaseModel):
    device_code: str

@router.post("/pair/device/request")
def request_device_pairing():
    """Generates a 6-digit VR device pairing code for VR headsets and smart players."""
    device_code = f"dev_{secrets.token_urlsafe(24)}"
    user_code = "".join(secrets.choice("0123456789") for _ in range(6))
    expires_at = time.time() + 300

    raw_key = f"vyr_vr_{secrets.token_urlsafe(32)}"
    key_hash = sha256(raw_key.encode()).hexdigest()

    DEVICE_PAIRING_STORE[device_code] = {
        "user_code": user_code,
        "status": "pending",
        "expires_at": expires_at,
        "user_id": None,
        "raw_key": raw_key,
        "key_hash": key_hash,
    }

    return {
        "device_code": device_code,
        "user_code": user_code,
        "expires_in": 300,
        "verification_uri": "/pair"
    }

@router.post("/pair/device/approve")
def approve_device_pairing(
    req: DeviceApproveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Authenticated user enters user_code on phone or desktop to approve a VR device pairing."""
    code = req.user_code.strip()
    now = time.time()

    target_device_code = None
    target_data = None
    for d_code, data in list(DEVICE_PAIRING_STORE.items()):
        if data["expires_at"] < now:
            DEVICE_PAIRING_STORE.pop(d_code, None)
            continue
        if data["user_code"] == code and data["status"] == "pending":
            target_device_code = d_code
            target_data = data
            break

    if not target_data or not target_device_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired pairing code."
        )

    from models import ApiKey
    new_key = ApiKey(
        name=req.device_name or "VR Headset (Paired)",
        key_hash=target_data["key_hash"],
        user_id=current_user.id,
        is_pairing=True
    )
    db.add(new_key)
    db.commit()

    target_data["status"] = "approved"
    target_data["user_id"] = current_user.id

    return {"status": "success", "message": "VR device paired successfully!"}

@router.post("/pair/device/poll")
def poll_device_pairing(
    req: DevicePollRequest,
    db: Session = Depends(get_db)
):
    """VR Headset polls to check if pairing code was approved by logged-in user."""
    data = DEVICE_PAIRING_STORE.get(req.device_code)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pairing request expired or invalid.")

    if time.time() > data["expires_at"]:
        DEVICE_PAIRING_STORE.pop(req.device_code, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pairing request expired.")

    if data["status"] == "pending":
        return {"status": "authorization_pending"}

    # Successfully approved!
    raw_key = data["raw_key"]
    user_id = data["user_id"]
    DEVICE_PAIRING_STORE.pop(req.device_code, None)

    return {
        "status": "success",
        "token": raw_key,
        "api_key": raw_key,
        "user_id": user_id
    }


class PairingRenameRequest(BaseModel):
    name: str


@router.get("/pairings")
def list_pairings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all registered browser extension pairings for the current user."""
    from models import ApiKey
    pairings = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.is_pairing
    ).order_by(ApiKey.created_at.desc()).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at,
            "last_used": p.last_used
        }
        for p in pairings
    ]


@router.patch("/pairings/{pairing_id}")
def rename_pairing(
    pairing_id: int,
    req: PairingRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a specific pairing for the current user."""
    from models import ApiKey
    pairing = db.query(ApiKey).filter(
        ApiKey.id == pairing_id,
        ApiKey.user_id == current_user.id,
        ApiKey.is_pairing
    ).first()
    
    if not pairing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pairing not found."
        )
        
    pairing.name = req.name.strip()
    db.commit()
    db.refresh(pairing)
    return {"id": pairing.id, "name": pairing.name}


@router.delete("/pairings/{pairing_id}")
def revoke_pairing(
    pairing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific pairing for the current user."""
    from models import ApiKey
    pairing = db.query(ApiKey).filter(
        ApiKey.id == pairing_id,
        ApiKey.user_id == current_user.id,
        ApiKey.is_pairing
    ).first()
    
    if not pairing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pairing not found."
        )
        
    db.delete(pairing)
    db.commit()
    return {"message": "Pairing revoked successfully."}

