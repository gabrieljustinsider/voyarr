from sqlalchemy.orm import Session
from models import Credential, Vault
from security import decrypt_data, encrypt_data


def _normalize_secret(secret: str) -> str:
    """Accept either a raw base32 secret or a full 'otpauth://' URI and return the base32 secret."""
    secret = secret.strip()
    if secret.startswith("otpauth://"):
        import urllib.parse

        query = urllib.parse.parse_qs(urllib.parse.urlparse(secret).query)
        secret = query.get("secret", [""])[0]
    # Strip spaces and padding; pyotp tolerates missing padding but not spaces
    return secret.replace(" ", "").replace("\n", "")


def get_totp_secret(db: Session, credential_id: int) -> str | None:
    entry = (
        db.query(Vault)
        .filter_by(
            entity_type="credential", entity_id=credential_id, key="totp_secret"
        )
        .first()
    )
    if entry and entry.encrypted_value:
        return decrypt_data(entry.encrypted_value)
    return None


def has_totp(db: Session, credential_id: int) -> bool:
    return bool(get_totp_secret(db, credential_id))


def set_totp_secret(db: Session, credential_id: int, secret: str) -> None:
    normalized = _normalize_secret(secret)
    if not normalized:
        raise ValueError("A valid TOTP secret is required.")
    _validate_secret(normalized)

    entry = (
        db.query(Vault)
        .filter_by(entity_type="credential", entity_id=credential_id, key="totp_secret")
        .first()
    )
    if entry:
        entry.encrypted_value = encrypt_data(normalized)
    else:
        db.add(
            Vault(
                entity_type="credential",
                entity_id=credential_id,
                key="totp_secret",
                encrypted_value=encrypt_data(normalized),
            )
        )


def delete_totp_secret(db: Session, credential_id: int) -> None:
    db.query(Vault).filter_by(
        entity_type="credential", entity_id=credential_id, key="totp_secret"
    ).delete()


def _validate_secret(secret: str) -> None:
    # Attempt to build a TOTP object; raises if base32 decoding fails.
    import pyotp

    pyotp.TOTP(secret)


def current_code(db: Session, credential_id: int) -> tuple[str, int]:
    secret = get_totp_secret(db, credential_id)
    if not secret:
        raise ValueError("No TOTP secret configured for this credential.")
    import pyotp

    totp = pyotp.TOTP(secret)
    return totp.now(), totp.interval - (int(__import__("time").time()) % totp.interval)