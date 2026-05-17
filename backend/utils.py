import os

def get_media_roots():
    """Parse the MEDIA_ROOT environment variable and return a list of all configured media roots. Resolves symlinks."""
    return [os.path.realpath(p.strip()) for p in os.getenv("MEDIA_ROOT", "/media/storage").split(",") if p.strip()]

def get_primary_root():
    """Return the primary (first) configured media root as the default fallback."""
    roots = get_media_roots()
    return roots[0] if roots else "/media/storage"