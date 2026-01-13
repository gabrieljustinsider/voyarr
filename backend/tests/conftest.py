import os
import tempfile
import sqlalchemy

# Redirect test database files to the system temporary directory to keep the root directory clean
def redirect_db_url(url_str: str) -> str:
    if url_str.startswith("sqlite:///file:testdb_"):
        db_name = url_str.split("?")[0].split("sqlite:///file:")[1]
        query_params = url_str.split("?")[1] if "?" in url_str else ""
        temp_dir = tempfile.gettempdir()
        new_url = f"sqlite:////{temp_dir}/{db_name}"
        if query_params:
            new_url += f"?{query_params}"
        return new_url
    return url_str

# 1. Update environment variable for any code that reads it directly
db_url = os.environ.get("DATABASE_URL")
if db_url:
    os.environ["DATABASE_URL"] = redirect_db_url(db_url)

# 2. Patch sqlalchemy.create_engine to dynamically redirect test URLs
original_create_engine = sqlalchemy.create_engine

def patched_create_engine(url, *args, **kwargs):
    if isinstance(url, str):
        url = redirect_db_url(url)
    elif hasattr(url, "render_as_string"):
        url_str = url.render_as_string()
        redirected = redirect_db_url(url_str)
        if redirected != url_str:
            url = redirected
    return original_create_engine(url, *args, **kwargs)

sqlalchemy.create_engine = patched_create_engine
