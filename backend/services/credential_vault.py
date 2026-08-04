from sqlalchemy.orm import Session
from models import Credential, Vault
from security import decrypt_data, encrypt_data


def get_fields(db: Session, credential_id: int) -> dict[str, str]:
    """Read all Vault entries for a credential, decrypted, keyed by Vault key."""
    items = (
        db.query(Vault)
        .filter(Vault.entity_type == "credential", Vault.entity_id == credential_id)
        .all()
    )
    return {item.key: decrypt_data(item.encrypted_value) for item in items}


def set_fields(db: Session, credential_id: int, fields: dict[str, str]) -> None:
    """Upsert the given fields into a credential's Vault entries, encrypted."""
    for key, val in fields.items():
        entry = (
            db.query(Vault)
            .filter_by(entity_type="credential", entity_id=credential_id, key=key)
            .first()
        )
        if entry:
            entry.encrypted_value = encrypt_data(val)
        else:
            db.add(
                Vault(
                    entity_type="credential",
                    entity_id=credential_id,
                    key=key,
                    encrypted_value=encrypt_data(val),
                )
            )


def get_credential(db: Session, provider_id: int) -> tuple[Credential | None, dict[str, str]]:
    """Return (credential row, decrypted fields) for a provider, or (None, {}) if unset."""
    cred = db.query(Credential).filter(Credential.provider_id == provider_id).first()
    if not cred:
        return None, {}
    return cred, get_fields(db, cred.id)


def get_username_password(db: Session, provider_id: int) -> tuple[str, str]:
    """Convenience: return (username, password) for a provider's credential."""
    _, fields = get_credential(db, provider_id)
    return fields.get("username", ""), fields.get("password", "")
