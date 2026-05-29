import os
import base64
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Passkey, User, Settings
from routers.auth import get_current_user
from security import create_access_token
from webauthn_utils import (
    generate_assertion_options,
    generate_registration_options,
    get_aaguid_metadata,
    resolve_ip_location,
    verify_assertion_signature,
    verify_client_data_challenge,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/passkeys", tags=["passkeys"])


def _check_passkeys_enabled(db: Session):
    """Raise HTTP 400 if Passkeys are disabled by the administrator. Passkeys are enabled by default."""
    setting = db.query(Settings).filter(Settings.key == "passkeys_enabled").first()
    if setting and setting.value.lower() != "true":
        raise HTTPException(
            status_code=400,
            detail="Passkey (WebAuthn) authentication is currently disabled by the administrator.",
        )

# Global in-memory storage for active challenges to avoid database pollution
REGISTRATION_CHALLENGES = {}
LOGIN_CHALLENGES = {}

class RegistrationOptionsRequest(BaseModel):
    pass

class RegistrationVerifyRequest(BaseModel):
    credential_id: str
    public_key: str  # Base64 DER-encoded SPKI public key from credential.response.getPublicKey()
    client_data_json: str  # Base64
    aaguid: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    browser: Optional[str] = None
    os_name: Optional[str] = None
    backup_eligible: Optional[bool] = True
    backup_state: Optional[bool] = True

class LoginOptionsRequest(BaseModel):
    username: Optional[str] = None

class LoginVerifyRequest(BaseModel):
    credential_id: str
    client_data_json: str  # Base64
    authenticator_data: str  # Base64
    signature: str  # Base64

class PasskeyRenameRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

@router.get("/", response_model=List[dict])
def list_passkeys(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    passkeys = db.query(Passkey).filter(Passkey.user_id == current_user.id).order_by(Passkey.created_at.desc()).all()
    
    result = []
    for pk in passkeys:
        aaguid_meta = get_aaguid_metadata(pk.aaguid)
        result.append({
            "id": pk.id,
            "name": pk.name,
            "credential_id": pk.credential_id,
            "created_at": pk.created_at,
            "last_used_at": pk.last_used_at,
            "ip_address": pk.ip_address,
            "location": pk.location,
            "browser": pk.browser,
            "os_name": pk.os_name,
            "backup_eligible": pk.backup_eligible,
            "backup_state": pk.backup_state,
            "aaguid_info": aaguid_meta
        })
    return result

def get_rp_id(request: Request) -> str:
    """
    Extracts the relying party ID dynamically from the inbound HTTP request.
    If the host is an IP address, localhost, or empty, we fall back to "localhost"
    as WebAuthn RP IDs must be valid domain names excluding ports.
    """
    hostname = request.url.hostname
    if not hostname:
        return "localhost"
    
    # Check if the hostname is a raw IPv4 address or contains colons (IPv6) or is 'localhost'
    import re
    is_ip = re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", hostname) or ":" in hostname
    
    if is_ip or hostname == "localhost":
        return "localhost"
        
    return hostname

@router.post("/register/options")
def register_options(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_passkeys_enabled(db)
    rp_id = get_rp_id(request)
    options = generate_registration_options(current_user.id, current_user.username, rp_id=rp_id)
    REGISTRATION_CHALLENGES[current_user.username] = options["challenge"]
    return options

@router.post("/register/verify")
def register_verify(
    req: RegistrationVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_passkeys_enabled(db)
    expected_challenge = REGISTRATION_CHALLENGES.pop(current_user.username, None)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No active registration challenge found. Please request options first.")
    
    if not verify_client_data_challenge(req.client_data_json, expected_challenge):
        raise HTTPException(status_code=400, detail="Challenge verification failed.")
    
    # Check if credential already exists
    existing = db.query(Passkey).filter(Passkey.credential_id == req.credential_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Credential already registered.")
    
    client_ip = request.client.host if request.client else "127.0.0.1"
    location = resolve_ip_location(client_ip)
    
    passkey = Passkey(
        user_id=current_user.id,
        name=req.name,
        credential_id=req.credential_id,
        public_key=req.public_key,
        aaguid=req.aaguid,
        ip_address=client_ip,
        location=location,
        browser=req.browser,
        os_name=req.os_name,
        backup_eligible=req.backup_eligible if req.backup_eligible is not None else True,
        backup_state=req.backup_state if req.backup_state is not None else True,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    
    db.add(passkey)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save passkey: {e}")
        raise HTTPException(status_code=500, detail="Database save failed.")
        
    return {"status": "success", "message": "Passkey registered successfully!"}

@router.post("/login/options")
def login_options(req: LoginOptionsRequest, request: Request, db: Session = Depends(get_db)):
    _check_passkeys_enabled(db)
    allowed_credentials = []
    if req.username:
        user = db.query(User).filter(User.username == req.username).first()
        if user:
            passkeys = db.query(Passkey).filter(Passkey.user_id == user.id).all()
            allowed_credentials = [pk.credential_id for pk in passkeys]
            
    rp_id = get_rp_id(request)
    options = generate_assertion_options(allowed_credentials, rp_id=rp_id)
    LOGIN_CHALLENGES[options["challenge"]] = datetime.now(timezone.utc)
    return options

@router.post("/login/verify")
def login_verify(
    req: LoginVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _check_passkeys_enabled(db)
    # Verify the challenge exists in active challenges
    try:
        # Decode clientDataJSON to read the challenge first
        padded = req.client_data_json + "=" * (-len(req.client_data_json) % 4)
        client_data_bytes = base64.b64decode(padded)
        client_data = json.loads(client_data_bytes.decode("utf-8"))
        client_challenge = client_data.get("challenge")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid client data JSON.")
        
    if not client_challenge or client_challenge not in LOGIN_CHALLENGES:
        raise HTTPException(status_code=400, detail="Login challenge expired or invalid.")
        
    # Clean up the one-time challenge
    LOGIN_CHALLENGES.pop(client_challenge, None)
    
    # Retrieve passkey record by credential_id
    passkey = db.query(Passkey).filter(Passkey.credential_id == req.credential_id).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="Passkey credential not recognized.")
        
    user = db.query(User).filter(User.id == passkey.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Associated user not found.")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Associated user account is inactive.")
        
    # Verify the signature
    verified = verify_assertion_signature(
        public_key_der_b64=passkey.public_key,
        authenticator_data_b64=req.authenticator_data,
        client_data_json_b64=req.client_data_json,
        signature_b64=req.signature
    )
    
    if not verified:
        raise HTTPException(status_code=401, detail="WebAuthn signature verification failed.")
        
    # Update last used metrics
    client_ip = request.client.host if request.client else "127.0.0.1"
    passkey.last_used_at = datetime.now(timezone.utc).replace(tzinfo=None)
    passkey.ip_address = client_ip
    passkey.location = resolve_ip_location(client_ip)
    passkey.sign_count += 1
    
    db.commit()
    from routers.auth import update_user_last_login
    update_user_last_login(db, user)
    
    # Generate access token
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
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
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.put("/{passkey_id}")
def rename_passkey(
    passkey_id: str,
    req: PasskeyRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    passkey = db.query(Passkey).filter(Passkey.id == passkey_id, Passkey.user_id == current_user.id).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="Passkey not found or unauthorized.")
        
    passkey.name = req.name
    db.commit()
    return {"status": "success", "message": "Passkey renamed successfully!"}

@router.delete("/{passkey_id}")
def delete_passkey(
    passkey_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    passkey = db.query(Passkey).filter(Passkey.id == passkey_id, Passkey.user_id == current_user.id).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="Passkey not found or unauthorized.")
        
    db.delete(passkey)
    db.commit()
    return {"status": "success", "message": "Passkey deleted successfully!"}
