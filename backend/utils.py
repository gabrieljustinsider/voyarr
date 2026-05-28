import os
import urllib.parse
import ipaddress
import socket
from fastapi import HTTPException
from db_utils import get_db_session
from models import Settings
from typing import Any, List


def get_media_roots() -> List[str]:
    """Parse the media_root_path setting from DB, fallback to CONTAINER_MEDIA_PATHS env var, and return a list of all configured media roots. Resolves symlinks and normalizes paths."""
    db_paths: str | None = None
    try:
        with get_db_session() as db:
            setting = (
                db.query(Settings).filter(Settings.key == "media_root_path").first()
            )
            if setting and setting.value is not None:
                db_paths = str(setting.value)
    except Exception as e:
        print(f"Error fetching media_root_path from DB: {e}")

    if not db_paths:
        db_paths = os.getenv("CONTAINER_MEDIA_PATHS", "/media/storage")

    # Split by comma, strip whitespace, remove empty entries, and normalize paths
    paths = [p.strip() for p in db_paths.split(",") if p.strip()]
    normalized_roots: List[str] = []
    for p in paths:
        real_p = os.path.realpath(os.path.expanduser(p))
        if real_p not in normalized_roots:
            normalized_roots.append(real_p)

    return normalized_roots


def get_primary_root() -> str:
    """Return the primary (first) configured media root as the default fallback."""
    roots = get_media_roots()
    return roots[0] if roots else "/media/storage"


def get_default_download_path() -> str:
    """Return the default download path configured in environment or based on primary root."""
    env_path = os.getenv("DEFAULT_DOWNLOAD_PATH")
    if env_path:
        return os.path.realpath(os.path.expanduser(env_path))
    return os.path.join(get_primary_root(), "downloads")


def initialize_network_settings():
    """
    Read global proxy & user-agent settings from DB or Vault,
    and dynamically update os.environ to configure outgoing HTTP calls (requests, yt-dlp, playwright).
    """
    try:
        from db_utils import get_db_session
        from models import Settings, Vault
        from security import decrypt_data

        proxy_enabled = False
        proxy_url: str | None = None
        user_agent: str | None = None

        with get_db_session() as db:
            # Query standard settings
            settings_keys = ["global_proxy_enabled", "global_user_agent"]
            db_settings = (
                db.query(Settings).filter(Settings.key.in_(settings_keys)).all()
            )
            for s in db_settings:
                if s.key == "global_proxy_enabled":
                    proxy_enabled = s.value == "true"
                elif s.key == "global_user_agent":
                    user_agent = str(s.value) if s.value is not None else None

            # Query secure settings from Vault
            db_vault = (
                db.query(Vault)
                .filter(
                    Vault.entity_type == "global_setting",
                    Vault.key == "global_proxy_url",
                )
                .first()
            )
            if db_vault and db_vault.encrypted_value is not None:
                try:
                    proxy_url = decrypt_data(str(db_vault.encrypted_value))
                except Exception as ex:
                    print(f"Error decrypting global_proxy_url: {ex}")
                    proxy_url = None

            # Fallback to standard settings if proxy_url not found in vault (in case of legacy/unencrypted storage)
            if not proxy_url:
                db_proxy_url_setting = (
                    db.query(Settings)
                    .filter(Settings.key == "global_proxy_url")
                    .first()
                )
                if db_proxy_url_setting and db_proxy_url_setting.value is not None:
                    proxy_url = str(db_proxy_url_setting.value)

        # Apply proxy environments dynamically
        if proxy_enabled and proxy_url:
            os.environ["HTTP_PROXY"] = str(proxy_url)
            os.environ["HTTPS_PROXY"] = str(proxy_url)
            os.environ["ALL_PROXY"] = str(proxy_url)
            os.environ["GLOBAL_PROXY_URL"] = str(proxy_url)
            os.environ["GLOBAL_PROXY_ENABLED"] = "true"
        else:
            # Purge dynamic variables from environment safely
            os.environ.pop("HTTP_PROXY", None)
            os.environ.pop("HTTPS_PROXY", None)
            os.environ.pop("ALL_PROXY", None)
            os.environ.pop("GLOBAL_PROXY_URL", None)
            os.environ.pop("GLOBAL_PROXY_ENABLED", None)

        # Apply global User-Agent environment dynamically
        if user_agent is not None:
            os.environ["DEFAULT_USER_AGENT"] = str(user_agent)
        else:
            os.environ.pop("DEFAULT_USER_AGENT", None)

    except Exception as e:
        err_msg = str(e)
        if any(x in err_msg for x in ["relation \"settings\" does not exist", "relation \"vault\" does not exist", "UndefinedTable", "no such table: settings", "no such table: vault"]):
            print("Database schema is not fully initialized yet (settings/vault table not found). Using default network settings.")
        elif any(x in err_msg for x in ["Connection refused", "OperationalError", "Can't reconnect", "Is the server running", "does not exist"]):
            print("Database is not reachable yet. Using default network settings.")
        else:
            print(f"Error initializing network settings: {e}")


def validate_url_ssrf(url_str: str):
    if not url_str.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    try:
        parsed = urllib.parse.urlparse(url_str)
        hostname = parsed.hostname.lower() if parsed.hostname else ""

        try:
            def is_disallowed_ip(ip_str_or_obj: Any) -> bool:
                try:
                    ip_obj = (
                        ipaddress.ip_address(ip_str_or_obj)
                        if isinstance(ip_str_or_obj, str)
                        else ip_str_or_obj
                    )

                    # Unwrap IPv4-mapped IPv6 addresses to correctly evaluate their underlying IPv4 properties
                    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
                        ip_obj = ip_obj.ipv4_mapped

                    return bool(
                        ip_obj.is_loopback
                        or ip_obj.is_private
                        or ip_obj.is_link_local
                        or ip_obj.is_multicast
                        or ip_obj.is_unspecified
                        or ip_obj.is_reserved
                    )
                except ValueError:
                    return False

            try:
                ip_obj = ipaddress.ip_address(hostname.strip("[]"))
                if is_disallowed_ip(ip_obj):
                    raise HTTPException(
                        status_code=400, detail="Disallowed internal IP"
                    )
            except ValueError:
                pass

            # Resolve hostname to catch custom domains pointing to internal IPs
            try:
                addr_info = socket.getaddrinfo(hostname, None)
                for addr in addr_info:
                    ip_str = addr[4][0]
                    if is_disallowed_ip(ip_str):
                        raise HTTPException(
                            status_code=400,
                            detail="Disallowed internal IP (resolved via DNS)",
                        )
            except socket.gaierror:
                pass
        except ImportError:
            pass
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(e)}")
