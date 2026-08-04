from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Credential, Vault
from schemas import CredentialCreate, CredentialResponse
from security import decrypt_data

from dependencies import verify_api_key
from rate_limiter import rate_limit

router = APIRouter(
    prefix="/credentials", tags=["credentials"], dependencies=[Depends(verify_api_key)]
)


@router.post(
    "",
    response_model=CredentialResponse,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))],
)
def create_credential(cred: CredentialCreate, db: Session = Depends(get_db)):
    try:
        # Check if credential already exists to update it rather than duplicating rows
        db_cred = db.query(Credential).filter_by(provider_id=cred.provider_id).first()
        if not db_cred:
            db_cred = Credential(
                provider_id=cred.provider_id,
                custom_limits=cred.custom_limits,
                sync_source="manual",
            )
            db.add(db_cred)
            db.flush()
        else:
            db_cred.custom_limits = cred.custom_limits
            db_cred.sync_source = (
                "manual"  # Manually editing locks it from being overwritten by syncs
            )

        # Store in Vault
        from services.credential_vault import set_fields
        set_fields(db, db_cred.id, {"username": cred.username, "password": cred.password})

        db.commit()
        db.refresh(db_cred)
        return db_cred
    except Exception as e:
        db.rollback()
        print(f"Credential save error: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to save credential due to an internal error"
        )


@router.get("")
def list_credentials(db: Session = Depends(get_db)):
    creds = db.query(Credential).all()
    out = []
    for cred in creds:
        vault_items = db.query(Vault).filter_by(entity_type="credential", entity_id=cred.id).all()
        vault_dict = {item.key: decrypt_data(item.encrypted_value) for item in vault_items}
        out.append({
            "id": cred.id,
            "provider_id": cred.provider_id,
            "username": vault_dict.get("username", ""),
            "password": vault_dict.get("password", ""),
            "custom_limits": cred.custom_limits or {},
            "sync_source": cred.sync_source,
            "created_at": cred.created_at,
        })
    return out


@router.get("/{provider_id}")
def get_credentials(provider_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    if not cred:
        return {
            "provider_id": provider_id,
            "username": "",
            "password": "",
            "custom_limits": {},
            "sync_source": "manual",
            "external_item_id": None,
            "external_vault_id": None,
            "has_totp": False,
        }

    vault_items = (
        db.query(Vault).filter_by(entity_type="credential", entity_id=cred.id).all()
    )
    vault_dict = {item.key: decrypt_data(item.encrypted_value) for item in vault_items}

    from services.totp_service import has_totp

    return {
        "provider_id": provider_id,
        "username": vault_dict.get("username", ""),
        "password": vault_dict.get("password", ""),
        "custom_limits": cred.custom_limits or {},
        "sync_source": cred.sync_source,
        "external_item_id": cred.external_item_id,
        "external_vault_id": cred.external_vault_id,
        "has_totp": has_totp(db, cred.id),
    }


@router.delete("/{provider_id}")
def delete_credential(provider_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Remove from Vault
    db.query(Vault).filter_by(entity_type="credential", entity_id=cred.id).delete()
    db.delete(cred)
    db.commit()
    return {"message": "Credential deleted successfully"}


class LinkRequest(BaseModel):
    item_id: str


class TotpRequest(BaseModel):
    secret: str


@router.post("/{provider_id}/link")
def link_credential(provider_id: int, req: LinkRequest, db: Session = Depends(get_db)):
    """Link a 1Password login item to a provider, storing its username/password/TOTP encrypted."""
    from services.onepassword_service import OnePasswordService
    from services.totp_service import set_totp_secret

    if not req.item_id:
        raise HTTPException(status_code=400, detail="item_id is required.")

    provider = db.query(__import__("models", fromlist=["Provider"]).Provider).filter_by(id=provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        fields = OnePasswordService.get_item_fields(db, req.item_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Failed to fetch 1Password item: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch the 1Password item.")

    username = fields.get("username", "")
    password = fields.get("password", "")
    if not (username and password):
        raise HTTPException(status_code=400, detail="The selected 1Password item has no username/password.")

    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred:
        db_cred = Credential(provider_id=provider_id, sync_source="1password")
        db.add(db_cred)
        db.flush()
    else:
        db_cred.sync_source = "1password"

    db_cred.external_item_id = req.item_id
    db_cred.external_vault_id = None

    from services.credential_vault import set_fields
    set_fields(db, db_cred.id, {"username": username, "password": password})

    if fields.get("otp"):
        try:
            set_totp_secret(db, db_cred.id, fields["otp"])
        except Exception:
            print("Linked item has an OTP field but it could not be parsed as a TOTP secret; skipping.")

    db.commit()
    return {"message": "Credential linked to 1Password item.", "provider_id": provider_id, "linked_item": req.item_id}


@router.post("/{provider_id}/refresh")
def refresh_credential(provider_id: int, db: Session = Depends(get_db)):
    """Re-fetch the linked 1Password item and update stored credentials."""
    from services.onepassword_service import OnePasswordService
    from services.totp_service import set_totp_secret

    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred or not db_cred.external_item_id:
        raise HTTPException(status_code=400, detail="This credential is not linked to a 1Password item.")

    try:
        fields = OnePasswordService.get_item_fields(db, db_cred.external_item_id)
    except Exception as e:
        print(f"Failed to refresh 1Password item: {e}")
        raise HTTPException(status_code=502, detail="Failed to refresh from 1Password.")

    username = fields.get("username", "")
    password = fields.get("password", "")
    if not (username and password):
        raise HTTPException(status_code=400, detail="The linked 1Password item has no username/password.")

    from services.credential_vault import set_fields
    set_fields(db, db_cred.id, {"username": username, "password": password})

    if fields.get("otp"):
        try:
            set_totp_secret(db, db_cred.id, fields["otp"])
        except Exception:
            pass

    db_cred.sync_source = "1password"
    db.commit()
    return {"message": "Credential refreshed from 1Password."}


@router.post("/{provider_id}/unlink")
def unlink_credential(provider_id: int, db: Session = Depends(get_db)):
    """Remove the 1Password linkage but keep the stored (encrypted) credentials."""
    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    db_cred.external_item_id = None
    db_cred.external_vault_id = None
    db_cred.sync_source = "manual"
    db.commit()
    return {"message": "Credential unlinked from 1Password (stored copy kept)."}


@router.post("/{provider_id}/totp")
def set_totp(provider_id: int, req: TotpRequest, db: Session = Depends(get_db)):
    """Store a TOTP secret (raw base32 or otpauth:// URI) encrypted for this provider."""
    from services.totp_service import set_totp_secret

    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred:
        raise HTTPException(status_code=404, detail="Credential not found. Save credentials first.")

    try:
        set_totp_secret(db, db_cred.id, req.secret)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return {"message": "TOTP secret stored successfully."}


@router.delete("/{provider_id}/totp")
def delete_totp(provider_id: int, db: Session = Depends(get_db)):
    from services.totp_service import delete_totp_secret

    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    delete_totp_secret(db, db_cred.id)
    db.commit()
    return {"message": "TOTP secret removed."}


@router.post("/{provider_id}/totp/code")
def current_totp_code(provider_id: int, db: Session = Depends(get_db)):
    """Return the current rotating 6-digit code + seconds remaining (secret never leaves backend)."""
    from services.totp_service import current_code

    db_cred = db.query(Credential).filter_by(provider_id=provider_id).first()
    if not db_cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    try:
        code, seconds_remaining = current_code(db, db_cred.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"code": code, "seconds_remaining": seconds_remaining}


@router.post("/{provider_id}/test")
def test_provider_sign_in(provider_id: int, db: Session = Depends(get_db)):
    """Dry-run the best sign-in strategy for a provider; does not persist cookies."""
    from services.provider_auth import test_sign_in
    from models import Provider

    provider = db.query(Provider).filter_by(id=provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        return test_sign_in(provider, db)
    except Exception as e:
        print(f"Test sign-in failed for {provider.name}: {e}")
        raise HTTPException(status_code=502, detail=f"Sign-in test failed: {e}")


@router.post("/{provider_id}/sign-in")
def provider_sign_in(provider_id: int, db: Session = Depends(get_db)):
    """Perform a real sign-in (cookie harvest) and store the resulting session cookie."""
    from services.provider_auth import sign_in
    from models import Provider

    provider = db.query(Provider).filter_by(id=provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        result = sign_in(provider, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Sign-in failed for {provider.name}: {e}")
        raise HTTPException(status_code=502, detail=f"Sign-in failed: {e}")

    if result.get("status") == "success":
        return {"message": "Signed in successfully; session cookie saved.", **result}
    return {"message": "Sign-in did not complete.", **result}


@router.post(
    "/sync/{manager}/{direction}",
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))],
)
def sync_credential_manager(
    manager: str, direction: str, db: Session = Depends(get_db)
):
    from services.credential_base import CredentialServiceBase

    _registry: dict[str, type[CredentialServiceBase]] = {}
    from services.onepassword_service import OnePasswordService
    from services.bitwarden_service import BitwardenService

    OnePasswordService.register(_registry)
    BitwardenService.register(_registry)

    service = _registry.get(manager)
    if service is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported credential manager. Use '1password' or 'bitwarden'.",
        )

    try:
        if direction == "push":
            count = service.push_credentials(db)
            return {
                "message": f"Successfully pushed {count} credentials to {manager.capitalize()}."
            }
        elif direction == "pull":
            count = service.pull_credentials(db)
            return {
                "message": f"Successfully pulled {count} credentials from {manager.capitalize()}."
            }
        else:
            raise HTTPException(
                status_code=400, detail="Invalid sync direction. Use 'push' or 'pull'."
            )
    except Exception as e:
        print(f"{manager.capitalize()} sync error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
