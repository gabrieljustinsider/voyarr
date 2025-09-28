import os
from db_utils import get_db_session
from models import Settings


def get_media_roots():
    """Parse the media_root_path setting from DB, fallback to MEDIA_ROOT env var, and return a list of all configured media roots. Resolves symlinks and normalizes paths."""
    db_paths = None
    try:
        with get_db_session() as db:
            setting = (
                db.query(Settings).filter(Settings.key == "media_root_path").first()
            )
            if setting and setting.value:
                db_paths = setting.value
    except Exception as e:
        print(f"Error fetching media_root_path from DB: {e}")

    if not db_paths:
        db_paths = os.getenv("MEDIA_ROOT", "/media/storage")

    # Split by comma, strip whitespace, remove empty entries, and normalize paths
    paths = [p.strip() for p in db_paths.split(",") if p.strip()]
    normalized_roots = []
    for p in paths:
        real_p = os.path.realpath(os.path.expanduser(p))
        if real_p not in normalized_roots:
            normalized_roots.append(real_p)

    return normalized_roots


def get_primary_root():
    """Return the primary (first) configured media root as the default fallback."""
    roots = get_media_roots()
    return roots[0] if roots else "/media/storage"


def get_default_download_path():
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
        proxy_url = None
        user_agent = None

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
                    user_agent = s.value

            # Query secure settings from Vault
            db_vault = (
                db.query(Vault)
                .filter(
                    Vault.entity_type == "global_setting",
                    Vault.key == "global_proxy_url",
                )
                .first()
            )
            if db_vault and db_vault.encrypted_value:
                try:
                    proxy_url = decrypt_data(db_vault.encrypted_value)
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
                if db_proxy_url_setting:
                    proxy_url = db_proxy_url_setting.value

        # Apply proxy environments dynamically
        if proxy_enabled and proxy_url:
            os.environ["HTTP_PROXY"] = proxy_url
            os.environ["HTTPS_PROXY"] = proxy_url
            os.environ["ALL_PROXY"] = proxy_url
            os.environ["GLOBAL_PROXY_URL"] = proxy_url
            os.environ["GLOBAL_PROXY_ENABLED"] = "true"
        else:
            # Purge dynamic variables from environment safely
            os.environ.pop("HTTP_PROXY", None)
            os.environ.pop("HTTPS_PROXY", None)
            os.environ.pop("ALL_PROXY", None)
            os.environ.pop("GLOBAL_PROXY_URL", None)
            os.environ.pop("GLOBAL_PROXY_ENABLED", None)

        # Apply global User-Agent environment dynamically
        if user_agent:
            os.environ["DEFAULT_USER_AGENT"] = user_agent
        else:
            os.environ.pop("DEFAULT_USER_AGENT", None)

    except Exception as e:
        print(f"Error initializing network settings: {e}")
