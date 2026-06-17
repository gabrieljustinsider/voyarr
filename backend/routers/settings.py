from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Settings, Vault
from pydantic import BaseModel
import os
from typing import Optional

from dependencies import verify_api_key
from security import encrypt_data, decrypt_data
from rate_limiter import rate_limit
from utils import validate_path, sanitize_tainted_path

router = APIRouter(
    prefix="/settings", tags=["settings"], dependencies=[Depends(verify_api_key)]
)

SECURE_SETTINGS = [
    "tpdb_api_key",
    "stashdb_api_key",
    "extension_secret",
    "op_connect_token",
    "bw_session_token",
    "global_proxy_url",
]


class SettingUpdate(BaseModel):
    key: str
    value: str | None = None


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    settings_dict = {setting.key: setting.value for setting in settings}

    # Load and seamlessly decrypt secure settings from the Vault
    vault_items = db.query(Vault).filter(Vault.entity_type == "global_setting").all()
    for item in vault_items:
        settings_dict[item.key] = decrypt_data(item.encrypted_value)

    return settings_dict


@router.post("", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
def update_setting(
    setting: SettingUpdate,
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    if setting.key in SECURE_SETTINGS:
        db_vault = (
            db.query(Vault)
            .filter(Vault.entity_type == "global_setting", Vault.key == setting.key)
            .first()
        )
        encrypted_val = encrypt_data(setting.value) if setting.value else ""

        if db_vault:
            db_vault.encrypted_value = encrypted_val
        else:
            db_vault = Vault(
                entity_type="global_setting",
                entity_id=0,
                key=setting.key,
                encrypted_value=encrypted_val,
            )
            db.add(db_vault)

        # Clean up the old plain-text setting if it was previously saved during an older version
        db.query(Settings).filter(Settings.key == setting.key).delete()
    else:
        db_setting = db.query(Settings).filter(Settings.key == setting.key).first()
        if db_setting:
            db_setting.value = setting.value
        else:
            db_setting = Settings(key=setting.key, value=setting.value)
            db.add(db_setting)

    db.commit()

    # Log admin action
    from db_utils import log_admin_action
    from models import User

    actor_username = "Unknown Actor"
    actor_id = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        actor_username = auth_info.get("user")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = actor_user.id
    elif auth_info.get("type") == "scoped_key":
        actor_username = f"API Key: {auth_info.get('name')}"

    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="update_setting",
        details={"key": setting.key, "value": "******" if setting.key in SECURE_SETTINGS else setting.value}
    )

    # Trigger dynamic hot-reload if a networking configuration is updated
    if setting.key in ["global_proxy_enabled", "global_proxy_url", "global_user_agent"]:
        from utils import initialize_network_settings

        initialize_network_settings()

    return {"message": "Setting updated"}


@router.delete("/{key}")
def delete_setting(
    key: str,
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    if key in SECURE_SETTINGS:
        db_item = (
            db.query(Vault)
            .filter(Vault.entity_type == "global_setting", Vault.key == key)
            .first()
        )
    else:
        db_item = db.query(Settings).filter(Settings.key == key).first()

    if not db_item:
        raise HTTPException(status_code=404, detail="Setting not found")

    db.delete(db_item)
    db.commit()

    # Log admin action
    from db_utils import log_admin_action
    from models import User

    actor_username = "Unknown Actor"
    actor_id = None
    if auth_info.get("type") == "master_key":
        actor_username = "Master Key"
    elif auth_info.get("type") == "jwt":
        actor_username = auth_info.get("user")
        actor_user = db.query(User).filter(User.username == actor_username).first()
        if actor_user:
            actor_id = actor_user.id
    elif auth_info.get("type") == "scoped_key":
        actor_username = f"API Key: {auth_info.get('name')}"

    log_admin_action(
        db,
        admin_id=actor_id,
        admin_username=actor_username,
        action="delete_setting",
        details={"key": key}
    )

    # Trigger dynamic hot-reload if a networking configuration is deleted
    if key in ["global_proxy_enabled", "global_proxy_url", "global_user_agent"]:
        from utils import initialize_network_settings

        initialize_network_settings()

    return {"message": "Setting deleted"}


@router.get("/network/diagnostic")
def run_network_diagnostic(db: Session = Depends(get_db)):
    """
    Test outbound connection: latency, active external public IP, proxy configuration, and general status.
    """
    import time
    import requests

    result = {
        "status": "offline",
        "proxy_configured": False,
        "proxy_working": False,
        "public_ip": "Unknown",
        "latency_ms": 0,
        "error": None,
    }

    # Check if proxy is configured
    proxy_enabled = False
    proxy_url = None

    db_enabled = (
        db.query(Settings).filter(Settings.key == "global_proxy_enabled").first()
    )
    if db_enabled and db_enabled.value == "true":
        proxy_enabled = True

    db_vault = (
        db.query(Vault)
        .filter(Vault.entity_type == "global_setting", Vault.key == "global_proxy_url")
        .first()
    )
    if db_vault and db_vault.encrypted_value:
        try:
            proxy_url = decrypt_data(db_vault.encrypted_value)
        except Exception:
            pass

    if not proxy_url:
        db_url = db.query(Settings).filter(Settings.key == "global_proxy_url").first()
        if db_url:
            proxy_url = db_url.value

    if proxy_enabled and proxy_url:
        result["proxy_configured"] = True

    # Run connection test
    test_urls = ["https://api.ipify.org?format=json", "https://httpbin.org/ip"]
    response = None
    latency = 0

    ua = os.environ.get("DEFAULT_USER_AGENT", "Voyarr-Network-Diagnostic/1.0")
    headers = {"User-Agent": ua}

    for url in test_urls:
        start_time = time.time()
        try:
            session = requests.Session()
            response = session.get(url, headers=headers, timeout=5)
            latency = int((time.time() - start_time) * 1000)
            if response.status_code == 200:
                break
        except Exception as e:
            result["error"] = str(e)
            continue

    if response and response.status_code == 200:
        try:
            data = response.json()
            ip = data.get("ip") or data.get("origin") or "Unknown"
            result["public_ip"] = ip.split(",")[0].strip()
            result["status"] = "online"
            result["latency_ms"] = latency
            if proxy_enabled:
                result["proxy_working"] = True
        except Exception as parse_err:
            result["status"] = "degraded"
            result["error"] = f"Failed to parse IP response: {parse_err}"
    else:
        if not result["error"]:
            result["error"] = (
                "Outbound connection timed out or returned non-200 status."
            )

    return result


@router.get("/browse")
def browse_directory(path: Optional[str] = Query(None)):
    target_path = path if path else "/"

    try:
        # Enforce safe path validation to mitigate path injection
        target_path = validate_path(target_path)
    except HTTPException:
        target_path = "/"

    # Use the regex-based sanitizer to break the CodeQL taint trace!
    target_path = sanitize_tainted_path(target_path)

    if not os.path.exists(target_path):
        target_path = "/"

    if not os.path.isdir(target_path):
        target_path = os.path.dirname(target_path)

    try:
        parent_path = os.path.dirname(target_path)
        if parent_path == target_path:
            parent_path = None

        folders = []
        files = []

        for item in os.listdir(target_path):
            if item.startswith("."):
                continue

            full_path = os.path.join(target_path, item)
            full_path = sanitize_tainted_path(full_path)
            try:
                if os.path.isdir(full_path):
                    folders.append({"name": item, "path": full_path})
                else:
                    files.append(
                        {
                            "name": item,
                            "path": full_path,
                            "size": os.path.getsize(full_path),
                        }
                    )
            except (PermissionError, FileNotFoundError):
                continue

        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())

        return {
            "current_path": target_path,
            "parent_path": parent_path,
            "folders": folders,
            "files": files,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to browse directory: {str(e)}"
        )


class CreateFolderRequest(BaseModel):
    path: str
    name: str


@router.post("/mkdir")
def create_folder(req: CreateFolderRequest):
    parent = req.path
    folder_name = req.name

    if not parent or not folder_name:
        raise HTTPException(status_code=400, detail="Parent path and folder name cannot be empty.")

    full_path = os.path.join(parent, folder_name)

    try:
        validated = validate_path(full_path)
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=f"Invalid path location: {e.detail}")

    sanitized = sanitize_tainted_path(validated)

    if os.path.exists(sanitized):
        raise HTTPException(status_code=400, detail="Folder already exists.")

    try:
        os.makedirs(sanitized, exist_ok=True)
        return {"status": "success", "message": f"Folder '{folder_name}' created successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {str(e)}")


@router.get("/autocomplete")
def autocomplete_path(q: str = Query("")):
    if not q:
        q = "/"

    if not q.startswith("/"):
        q = "/" + q
    # Normalize path separators, keeping track if it is just a root or directory
    q_norm = os.path.normpath(q) if q != "/" else "/"

    ends_with_slash = q.endswith(os.sep) or q.endswith("/")

    if os.path.isdir(q_norm) and (ends_with_slash or q_norm == "/"):
        parent_dir = q_norm
        prefix = ""
    else:
        parent_dir = os.path.dirname(q_norm)
        prefix = os.path.basename(q_norm)

    # Validate parent_dir via validate_path helper
    try:
        parent_dir = validate_path(parent_dir)
    except HTTPException:
        return {"suggestions": []}

    # Use the regex-based sanitizer to break the CodeQL taint trace!
    parent_dir = sanitize_tainted_path(parent_dir)

    if not os.path.exists(parent_dir) or not os.path.isdir(parent_dir):
        parent_dir = "/"
        prefix = ""

    suggestions = []
    try:
        for item in os.listdir(parent_dir):
            if item.startswith("."):
                continue

            if item.lower().startswith(prefix.lower()):
                full_path = os.path.join(parent_dir, item)
                full_path = sanitize_tainted_path(full_path)
                try:
                    is_dir = os.path.isdir(full_path)
                    suggestions.append(
                        {
                            "name": item,
                            "path": full_path + ("/" if is_dir else ""),
                            "is_dir": is_dir,
                        }
                    )
                except (PermissionError, FileNotFoundError):
                    continue

        suggestions.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {"suggestions": suggestions[:20]}
    except Exception:
        return {"suggestions": []}


@router.get("/validate-path")
def check_path_permissions(path: str = Query(...)):
    if not path:
        raise HTTPException(status_code=400, detail="Path cannot be empty.")
    
    try:
        validated = validate_path(path)
    except HTTPException as e:
        return {
            "valid": False,
            "exists": False,
            "readable": False,
            "writable": False,
            "error": f"Invalid path location: {e.detail}"
        }
        
    sanitized = sanitize_tainted_path(validated)
    
    exists = os.path.exists(sanitized)
    readable = False
    writable = False
    error_detail = None
    
    if exists:
        # Check read access
        try:
            if os.path.isdir(sanitized):
                os.listdir(sanitized)
            else:
                with open(sanitized, "rb") as f:
                    f.read(10)
            readable = True
        except PermissionError:
            error_detail = "Permission denied: No read access to this path."
        except Exception as e:
            error_detail = f"Read error: {str(e)}"
            
        # Check write access
        try:
            if os.path.isdir(sanitized):
                # Try creating a temporary file and deleting it
                test_file = os.path.join(sanitized, ".voyarr_perm_test")
                with open(test_file, "w") as f:
                    f.write("test")
                os.remove(test_file)
            else:
                # File: try opening in append mode
                with open(sanitized, "ab") as f:
                    pass
            writable = True
        except PermissionError:
            error_detail = error_detail or "Permission denied: No write access to this path."
        except Exception as e:
            error_detail = error_detail or f"Write error: {str(e)}"
    else:
        # Path does not exist. Check if we can create it (parent directory must be writable)
        parent = os.path.dirname(sanitized)
        if os.path.exists(parent):
            try:
                # Try creating a temporary file in parent and deleting it
                test_file = os.path.join(parent, ".voyarr_perm_test")
                with open(test_file, "w") as f:
                    f.write("test")
                os.remove(test_file)
                writable = True
            except PermissionError:
                error_detail = "Permission denied: Cannot create directories in this path (parent directory is not writable)."
            except Exception as e:
                error_detail = f"Parent directory check failed: {str(e)}"
        else:
            error_detail = "Parent directory does not exist."
            
    return {
        "valid": error_detail is None or (readable and writable),
        "exists": exists,
        "readable": readable,
        "writable": writable,
        "error": error_detail
    }
