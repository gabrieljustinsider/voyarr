import os
from db_utils import get_db_session
from models import Settings

def get_media_roots():
    """Parse the media_root_path setting from DB, fallback to MEDIA_ROOT env var, and return a list of all configured media roots. Resolves symlinks and normalizes paths."""
    db_paths = None
    try:
        with get_db_session() as db:
            setting = db.query(Settings).filter(Settings.key == "media_root_path").first()
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