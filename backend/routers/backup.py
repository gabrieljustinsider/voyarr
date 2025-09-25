from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Base, Settings
from datetime import datetime, timezone, date
import json
import uuid
import secrets
import hashlib
import hmac
import base64
import os
from typing import Optional
from decimal import Decimal
from dependencies import verify_api_key
from rate_limiter import rate_limit

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

router = APIRouter(
    prefix="/backup", tags=["backup"], dependencies=[Depends(verify_api_key)]
)

from security import JWT_SECRET
HMAC_KEY = (JWT_SECRET or "voyarr-fallback-secret").encode()


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, bytes):
            return f"\\x{obj.hex()}"
        return super().default(obj)


def derive_fernet_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def calculate_hmac(key: bytes, message: bytes) -> str:
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def get_backup_dir() -> str:
    if os.path.exists("/app/backups"):
        return "/app/backups"
    else:
        from utils import get_primary_root
        primary_root = get_primary_root()
        return os.path.join(primary_root, "backups")


def process_verify_and_decrypt(data: dict, password: Optional[str] = None) -> dict:
    if "type" not in data or "version" not in data:
        return {"valid": False, "message": "Invalid backup format: missing required metadata fields"}

    is_encrypted = data.get("encrypted", False)

    if is_encrypted:
        if "salt" not in data or "ciphertext" not in data or "signature" not in data:
            return {"valid": False, "message": "Invalid backup format: missing required encryption fields"}

        if not password:
            return {
                "valid": True,
                "encrypted": True,
                "type": data["type"],
                "timestamp": data.get("timestamp"),
                "message": "Backup is valid but encrypted. Decryption passphrase required."
            }

        try:
            salt = bytes.fromhex(data["salt"])
            ciphertext = data["ciphertext"]
            signature = data["signature"]
            checksum = data.get("checksum", "")

            # 1. Derive key
            derived_key = derive_fernet_key(password, salt)

            # 2. Verify HMAC-SHA256 signature of ciphertext
            expected_sig = calculate_hmac(derived_key, ciphertext.encode())
            if not hmac.compare_digest(expected_sig, signature):
                return {"valid": False, "message": "Signature verification failed: invalid password or tampered backup."}

            # 3. Decrypt ciphertext
            cipher = Fernet(derived_key)
            decrypted_bytes = cipher.decrypt(ciphertext.encode())
            decrypted_str = decrypted_bytes.decode()

            # 4. Verify checksum of decrypted plaintext if available
            if checksum:
                expected_checksum = hashlib.sha256(decrypted_bytes).hexdigest()
                if expected_checksum != checksum:
                    return {"valid": False, "message": "Integrity check failed: decrypted content checksum mismatch."}

            decrypted_data = json.loads(decrypted_str)

        except Exception as e:
            return {"valid": False, "message": f"Decryption failed: {str(e)}"}

        if data["type"] == "settings":
            table_count = 1
            record_count = len(decrypted_data.get("settings", []))
        else:
            table_count = len(decrypted_data.keys())
            record_count = sum(len(rows) for rows in decrypted_data.values())

        return {
            "valid": True,
            "encrypted": True,
            "verified_signature": True,
            "type": data["type"],
            "timestamp": data.get("timestamp"),
            "table_count": table_count,
            "record_count": record_count,
            "checksum": checksum,
            "decrypted_data": decrypted_data,
            "message": "Backup decrypted and verified successfully."
        }

    else:
        if "data" not in data:
            return {"valid": False, "message": "Invalid backup format: missing backup data"}

        signature = data.get("signature", "")
        checksum = data.get("checksum", "")
        verified_signature = False

        data_payload = data["data"]
        data_str = json.dumps(data_payload, cls=CustomJSONEncoder)

        if signature:
            expected_sig = calculate_hmac(HMAC_KEY, data_str.encode())
            if hmac.compare_digest(expected_sig, signature):
                verified_signature = True

        if checksum:
            expected_checksum = hashlib.sha256(data_str.encode()).hexdigest()
            if expected_checksum != checksum:
                return {"valid": False, "message": "Integrity check failed: payload checksum mismatch."}

        if data["type"] == "settings":
            table_count = 1
            record_count = len(data_payload.get("settings", []))
        else:
            table_count = len(data_payload.keys())
            record_count = sum(len(rows) for rows in data_payload.values())

        return {
            "valid": True,
            "encrypted": False,
            "verified_signature": verified_signature,
            "type": data["type"],
            "timestamp": data.get("timestamp"),
            "table_count": table_count,
            "record_count": record_count,
            "checksum": checksum or hashlib.sha256(data_str.encode()).hexdigest(),
            "decrypted_data": data_payload,
            "message": "Backup verified successfully." if verified_signature else "Backup verified successfully (unsigned or signature mismatch)."
        }


@router.get("/tables")
def get_backup_tables():
    return {"tables": [table.name for table in Base.metadata.sorted_tables]}


@router.get(
    "/export", dependencies=[Depends(rate_limit(max_requests=2, window_seconds=60))]
)
def export_backup(
    type: str = "full",
    tables: Optional[str] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if type == "settings":
        from models import Vault
        from security import decrypt_data

        settings = db.query(Settings).all()
        settings_list = [{"key": s.key, "value": s.value} for s in settings]

        vault_items = (
            db.query(Vault).filter(Vault.entity_type == "global_setting").all()
        )
        for item in vault_items:
            settings_list.append(
                {"key": item.key, "value": decrypt_data(item.encrypted_value)}
            )

        raw_payload = {"settings": settings_list}

    elif type == "full":
        raw_payload = {}
        for table in Base.metadata.sorted_tables:
            rows = db.execute(table.select()).mappings().all()
            raw_payload[table.name] = [dict(row) for row in rows]

    elif type == "custom":
        if not tables:
            raise HTTPException(
                status_code=400, detail="Tables must be specified for custom backup"
            )
        target_tables = [t.strip() for t in tables.split(",")]
        raw_payload = {}
        for table in Base.metadata.sorted_tables:
            if table.name in target_tables:
                rows = db.execute(table.select()).mappings().all()
                raw_payload[table.name] = [dict(row) for row in rows]
    else:
        raise HTTPException(status_code=400, detail="Invalid export type")

    # Serialize raw payload using custom JSON encoder
    raw_str = json.dumps(raw_payload, cls=CustomJSONEncoder)
    checksum = hashlib.sha256(raw_str.encode()).hexdigest()

    export_data = {
        "type": type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
        "checksum": checksum,
    }

    if password:
        # Encryption Mode
        salt = secrets.token_bytes(16)
        derived_key = derive_fernet_key(password, salt)
        cipher = Fernet(derived_key)
        ciphertext = cipher.encrypt(raw_str.encode()).decode()
        signature = calculate_hmac(derived_key, ciphertext.encode())

        export_data.update({
            "encrypted": True,
            "salt": salt.hex(),
            "ciphertext": ciphertext,
            "signature": signature
        })
    else:
        # Plaintext Mode with Server Signature
        signature = calculate_hmac(HMAC_KEY, raw_str.encode())
        export_data.update({
            "encrypted": False,
            "data": raw_payload,
            "signature": signature
        })

    return Response(
        content=json.dumps(export_data),
        media_type="application/json",
    )


@router.post("/verify")
def verify_backup(
    file: UploadFile = File(...),
    password: Optional[str] = Query(None)
):
    try:
        content = file.file.read()
        backup_data = json.loads(content)
        result = process_verify_and_decrypt(backup_data, password)
        return result
    except json.JSONDecodeError:
        return {
            "valid": False,
            "message": "Invalid backup format: not a valid JSON file",
        }
    except Exception as e:
        print(f"Backup verification error: {str(e)}")
        return {
            "valid": False,
            "message": f"Verification failed due to an internal error: {str(e)}",
        }


@router.post(
    "/restore", dependencies=[Depends(rate_limit(max_requests=2, window_seconds=60))]
)
def restore_backup(
    file: UploadFile = File(...),
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read()
        backup_data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid backup format: not a valid JSON file")

    return execute_restore_logic(backup_data, password, db)


def execute_restore_logic(backup_data: dict, password: Optional[str], db: Session) -> dict:
    verify_result = process_verify_and_decrypt(backup_data, password)
    if not verify_result["valid"]:
        raise HTTPException(status_code=400, detail=verify_result["message"])

    if verify_result.get("encrypted") and not verify_result.get("decrypted_data"):
        raise HTTPException(status_code=400, detail="Backup is encrypted. Please provide the passphrase.")

    btype = verify_result["type"]
    payload = verify_result["decrypted_data"]

    try:
        if btype == "settings":
            from models import Vault
            from security import encrypt_data

            try:
                db.query(Settings).delete()
                db.query(Vault).filter(Vault.entity_type == "global_setting").delete()

                SECURE_SETTINGS = [
                    "tpdb_api_key",
                    "stashdb_api_key",
                    "extension_secret",
                    "op_connect_token",
                    "bw_session_token",
                ]

                for item in payload.get("settings", []):
                    if item["key"] in SECURE_SETTINGS:
                        db.add(
                            Vault(
                                entity_type="global_setting",
                                entity_id=0,
                                key=item["key"],
                                encrypted_value=encrypt_data(item["value"])
                                if item["value"]
                                else "",
                            )
                        )
                    else:
                        db.add(Settings(key=item["key"], value=item["value"]))
                db.commit()
                return {"message": "Settings restored successfully"}
            except Exception as e:
                db.rollback()
                raise e

        elif btype == "full":
            tables_reversed = list(reversed(Base.metadata.sorted_tables))

            for table in tables_reversed:
                db.execute(table.delete())

            for table in Base.metadata.sorted_tables:
                table_name = table.name
                rows = payload.get(table_name, [])
                if rows:
                    db.execute(table.insert(), rows)

            for table in Base.metadata.sorted_tables:
                table_name = table.name
                try:
                    with db.begin_nested():
                        db.execute(
                            text(
                                f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {table_name};"  # nosec B608
                            )
                        )
                except Exception as e:
                    print(f"Could not reset sequence for table '{table_name}': {e}")

            db.commit()
            return {"message": "Full database restored successfully"}

        elif btype == "custom":
            tables_in_backup = list(payload.keys())
            sorted_metadata_tables = Base.metadata.sorted_tables
            tables_to_restore = [
                t for t in sorted_metadata_tables if t.name in tables_in_backup
            ]
            tables_to_restore_reversed = list(reversed(tables_to_restore))

            for table in tables_to_restore_reversed:
                db.execute(table.delete())

            for table in tables_to_restore:
                table_name = table.name
                rows = payload.get(table_name, [])
                if rows:
                    db.execute(table.insert(), rows)

            for table in tables_to_restore:
                table_name = table.name
                try:
                    with db.begin_nested():
                        db.execute(
                            text(
                                f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {table_name};"  # nosec B608
                            )
                        )
                except Exception as e:
                    print(f"Could not reset sequence for table '{table_name}': {e}")
            db.commit()
            return {
                "message": f"Custom tables ({', '.join(tables_in_backup)}) restored successfully"
            }
    except Exception as e:
        db.rollback()
        print(f"Database restore error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Restore failed due to an internal server error: {str(e)}"
        )


@router.get("/local-list")
def list_local_backups():
    backup_dir = get_backup_dir()
    if not os.path.exists(backup_dir):
        return {"backups": []}

    try:
        files = []
        for item in os.listdir(backup_dir):
            if item.endswith(".json"):
                full_path = os.path.join(backup_dir, item)
                files.append({
                    "name": item,
                    "path": full_path,
                    "size": os.path.getsize(full_path),
                    "created_at": datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()
                })
        files.sort(key=lambda x: x["created_at"], reverse=True)
        return {"backups": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list local backups: {str(e)}")


@router.post("/verify-local")
def verify_local_backup(
    filepath: str = Query(...),
    password: Optional[str] = Query(None)
):
    backup_dir = get_backup_dir()
    abs_backup_dir = os.path.abspath(backup_dir)
    abs_filepath = os.path.abspath(filepath)
    
    try:
        if os.path.commonpath([abs_backup_dir, abs_filepath]) != abs_backup_dir:
            raise HTTPException(status_code=403, detail="Access denied: path lies outside backups folder boundary")
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: invalid path")

    if not os.path.exists(abs_filepath):
        raise HTTPException(status_code=404, detail="Local backup file not found")

    try:
        with open(abs_filepath, "r") as f:
            backup_data = json.load(f)
        return process_verify_and_decrypt(backup_data, password)
    except json.JSONDecodeError:
        return {"valid": False, "message": "Invalid backup format: not a valid JSON file"}
    except Exception as e:
        return {"valid": False, "message": f"Verification failed: {str(e)}"}


@router.post("/restore-local")
def restore_local_backup(
    filepath: str = Query(...),
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    backup_dir = get_backup_dir()
    abs_backup_dir = os.path.abspath(backup_dir)
    abs_filepath = os.path.abspath(filepath)
    
    try:
        if os.path.commonpath([abs_backup_dir, abs_filepath]) != abs_backup_dir:
            raise HTTPException(status_code=403, detail="Access denied: path lies outside backups folder boundary")
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: invalid path")

    if not os.path.exists(abs_filepath):
        raise HTTPException(status_code=404, detail="Local backup file not found")

    try:
        with open(abs_filepath, "r") as f:
            backup_data = json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid backup format: not a valid JSON file")

    return execute_restore_logic(backup_data, password, db)
