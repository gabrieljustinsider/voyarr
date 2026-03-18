from contextlib import contextmanager
import database
from typing import Optional, Any


@contextmanager
def get_db_session():
    db = database.SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_or_create_studio_by_name(db, studio_name: str) -> Optional[int]:
    if not studio_name:
        return None
    studio_name = studio_name.strip()
    if not studio_name:
        return None
    from models import Studio

    # Case-insensitive query
    studio = db.query(Studio).filter(Studio.name.ilike(studio_name)).first()
    if studio:
        return studio.id
    else:
        # Create a new studio profile
        studio = Studio(name=studio_name)
        db.add(studio)
        db.flush()
        return studio.id


def run_schema_migrations(engine):
    import logging
    logger = logging.getLogger(__name__)
    from sqlalchemy import text
    dialect_name = engine.name

    with engine.connect() as conn:
        # 1. Check if users table has permissions column, if not, add it
        try:
            conn.execute(text("SELECT permissions FROM users LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                if dialect_name == "postgresql":
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '{\"can_stream\": true, \"can_scrape\": false, \"can_rip\": false}'::jsonb"))
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{\"can_stream\": true, \"can_scrape\": false, \"can_rip\": false}'"))
                conn.commit()
                logger.info("Database migration successfully added 'permissions' to 'users'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add permissions column (it may already exist): {e}")

        # 2. Check if admin_logs table exists, if not, create it
        try:
            conn.execute(text("SELECT id FROM admin_logs LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            if dialect_name == "postgresql":
                create_table_sql = """
                CREATE TABLE admin_logs (
                    id SERIAL PRIMARY KEY,
                    admin_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    admin_username VARCHAR(255) NOT NULL,
                    action VARCHAR(255) NOT NULL,
                    details JSONB DEFAULT '{}'::jsonb,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            else:
                create_table_sql = """
                CREATE TABLE admin_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    admin_username VARCHAR(255) NOT NULL,
                    action VARCHAR(255) NOT NULL,
                    details TEXT DEFAULT '{}',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            try:
                conn.execute(text(create_table_sql))
                conn.commit()
                logger.info("Database migration successfully created 'admin_logs' table.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to create admin_logs table (it may already exist): {e}")

        # 3. Check if library_entries table has new columns, if not, add them
        for col, col_type, default_val in [
            ("adheres_to_naming_scheme", "BOOLEAN", "TRUE"),
            ("has_metadata_match", "BOOLEAN", "FALSE"),
            ("has_chapters", "BOOLEAN", "FALSE"),
            ("has_facial_clusters", "BOOLEAN", "FALSE")
        ]:
            try:
                conn.execute(text(f"SELECT {col} FROM library_entries LIMIT 1"))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                try:
                    conn.execute(text(f"ALTER TABLE library_entries ADD COLUMN {col} {col_type} DEFAULT {default_val}"))
                    conn.commit()
                    logger.info(f"Database migration successfully added '{col}' to 'library_entries'.")
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to add column {col} (it may already exist): {e}")

        # 4. Check if file_naming_history table exists, if not, create it
        try:
            conn.execute(text("SELECT id FROM file_naming_history LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            if dialect_name == "postgresql":
                create_table_sql = """
                CREATE TABLE file_naming_history (
                    id SERIAL PRIMARY KEY,
                    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
                    old_path TEXT,
                    new_path TEXT NOT NULL,
                    old_filename VARCHAR(500),
                    new_filename VARCHAR(500) NOT NULL,
                    reason VARCHAR(255),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            else:
                create_table_sql = """
                CREATE TABLE file_naming_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
                    old_path TEXT,
                    new_path TEXT NOT NULL,
                    old_filename VARCHAR(500),
                    new_filename VARCHAR(500) NOT NULL,
                    reason VARCHAR(255),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            try:
                conn.execute(text(create_table_sql))
                conn.commit()
                logger.info("Database migration successfully created 'file_naming_history' table.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to create file_naming_history table (it may already exist): {e}")


def is_feature_enabled(db, feature: str, user: Optional[Any] = None) -> bool:
    from models import Settings
    if feature == "streaming":
        setting = db.query(Settings).filter(Settings.key == "streaming_enabled").first()
        global_enabled = (setting.value.lower() == "true") if setting else True
    elif feature == "scraping":
        setting = db.query(Settings).filter(Settings.key == "scraping_enabled").first()
        global_enabled = (setting.value.lower() == "true") if setting else False
    elif feature == "ripping":
        setting = db.query(Settings).filter(Settings.key == "ripping_enabled").first()
        global_enabled = (setting.value.lower() == "true") if setting else False
    else:
        global_enabled = True

    if not global_enabled:
        return False

    if user is not None:
        if getattr(user, "role", None) == "admin":
            return True

        permissions = getattr(user, "permissions", None) or {}
        if isinstance(permissions, str):
            import json
            try:
                permissions = json.loads(permissions)
            except Exception:
                permissions = {}

        if feature == "streaming":
            return permissions.get("can_stream", True)
        elif feature == "scraping":
            return permissions.get("can_scrape", False)
        elif feature == "ripping":
            return permissions.get("can_rip", False)

    return True


def check_feature_permission(db, feature: str, user: Optional[Any] = None):
    from fastapi import HTTPException
    if not is_feature_enabled(db, feature, user):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: the '{feature}' feature is disabled globally or you do not have permission to access it."
        )


def log_admin_action(db, admin_id: Optional[str], admin_username: str, action: str, details: dict):
    from models import AdminLog
    try:
        log_entry = AdminLog(
            admin_id=admin_id,
            admin_username=admin_username,
            action=action,
            details=details
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to log admin action: {e}")
