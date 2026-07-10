from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Credential, Vault
from schemas import CredentialCreate, CredentialResponse
from security import encrypt_data, decrypt_data

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
        for key, val in [("username", cred.username), ("password", cred.password)]:
            v = (
                db.query(Vault)
                .filter_by(entity_type="credential", entity_id=db_cred.id, key=key)
                .first()
            )
            if v:
                v.encrypted_value = encrypt_data(val)
            else:
                db.add(
                    Vault(
                        entity_type="credential",
                        entity_id=db_cred.id,
                        key=key,
                        encrypted_value=encrypt_data(val),
                    )
                )

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
        }

    vault_items = (
        db.query(Vault).filter_by(entity_type="credential", entity_id=cred.id).all()
    )
    vault_dict = {item.key: decrypt_data(item.encrypted_value) for item in vault_items}

    return {
        "provider_id": provider_id,
        "username": vault_dict.get("username", ""),
        "password": vault_dict.get("password", ""),
        "custom_limits": cred.custom_limits or {},
        "sync_source": cred.sync_source,
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
