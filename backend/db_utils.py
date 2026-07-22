from contextlib import contextmanager
import database
from typing import Optional, Any, cast
from sqlalchemy.orm import Session


@contextmanager
def get_db_session():
    db = database.SessionLocal()
    # PERFORMANCE: Disabling expire_on_commit prevents SQLAlchemy from executing 
    # redundant SELECT queries to refresh object attributes after every db.commit()
    # This is a massive optimization for Celery tasks running in long loops.
    db.expire_on_commit = False
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_or_create_studio_by_name(db: Session, studio_name: str) -> Optional[int]:
    if not studio_name:
        return None
    studio_name = studio_name.strip()
    if not studio_name:
        return None
    from models import Studio

    # Case-insensitive query
    studio = db.query(Studio).filter(Studio.name.ilike(studio_name)).first()
    if studio:
        return cast(int, studio.id)
    else:
        # Create a new studio profile
        studio = Studio(name=studio_name)
        db.add(studio)
        db.flush()
        return cast(int, studio.id)


def run_schema_migrations(engine: Any) -> None:
    import logging
    logger = logging.getLogger(__name__)
    from sqlalchemy import text, inspect
    dialect_name = engine.name

    # Pre-defined static SQL migrations to eliminate CodeQL dynamic query (SQL Injection) warnings
    USERS_MIGRATIONS = {
        "display_name": "ALTER TABLE users ADD COLUMN display_name VARCHAR(255) NULL",
        "email": "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL",
        "avatar_url": "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL",
        "locale": "ALTER TABLE users ADD COLUMN locale VARCHAR(50) DEFAULT 'en'",
        "date_format": "ALTER TABLE users ADD COLUMN date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD'",
        "time_format": "ALTER TABLE users ADD COLUMN time_format VARCHAR(50) DEFAULT 'HH:mm:ss'",
        "timezone": "ALTER TABLE users ADD COLUMN timezone VARCHAR(100) DEFAULT 'UTC'"
    }

    LIBRARY_ENTRIES_MIGRATIONS = {
        "adheres_to_naming_scheme": "ALTER TABLE library_entries ADD COLUMN adheres_to_naming_scheme BOOLEAN DEFAULT TRUE",
        "has_metadata_match": "ALTER TABLE library_entries ADD COLUMN has_metadata_match BOOLEAN DEFAULT FALSE",
        "has_chapters": "ALTER TABLE library_entries ADD COLUMN has_chapters BOOLEAN DEFAULT FALSE",
        "has_facial_clusters": "ALTER TABLE library_entries ADD COLUMN has_facial_clusters BOOLEAN DEFAULT FALSE"
    }

    BILLERS_MIGRATIONS = {
        "support_email": "ALTER TABLE billers ADD COLUMN support_email VARCHAR(255)",
        "support_phone": "ALTER TABLE billers ADD COLUMN support_phone VARCHAR(50)",
        "description": "ALTER TABLE billers ADD COLUMN description TEXT"
    }

    SUBSCRIPTIONS_MIGRATIONS = {
        "biller_id": "ALTER TABLE subscriptions ADD COLUMN biller_id INTEGER REFERENCES billers(id) ON DELETE SET NULL",
        "billing_cycle": "ALTER TABLE subscriptions ADD COLUMN billing_cycle VARCHAR(50)",
        "cost": "ALTER TABLE subscriptions ADD COLUMN cost DECIMAL(10, 2)",
        "charge_type": "ALTER TABLE subscriptions ADD COLUMN charge_type VARCHAR(50) DEFAULT 'bulk'",
        "installment_frequency": "ALTER TABLE subscriptions ADD COLUMN installment_frequency VARCHAR(50)",
        "subscription_id": "ALTER TABLE subscriptions ADD COLUMN subscription_id VARCHAR(255)",
        "order_number": "ALTER TABLE subscriptions ADD COLUMN order_number VARCHAR(255)"
    }

    inspector = inspect(engine)
    def get_existing_columns(table_name):
        try:
            return {c["name"] for c in inspector.get_columns(table_name)}
        except Exception:
            return set()

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
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '{\"library\": \"view\", \"streaming\": \"view\", \"scraping\": \"none\", \"ripping\": \"none\", \"requests\": \"view\", \"settings\": \"none\", \"billing\": \"none\", \"providers\": \"none\", \"lens_access\": \"none\", \"lens_features\": \"none\"}'::jsonb"))
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{\"library\": \"view\", \"streaming\": \"view\", \"scraping\": \"none\", \"ripping\": \"none\", \"requests\": \"view\", \"settings\": \"none\", \"billing\": \"none\", \"providers\": \"none\", \"lens_access\": \"none\", \"lens_features\": \"none\"}'"))
                conn.commit()
                logger.info("Database migration successfully added 'permissions' to 'users'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add permissions column (it may already exist): {e}")

        # 1b. Check if users table has last_login_at column, if not, add it
        try:
            conn.execute(text("SELECT last_login_at FROM users LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP"))
                conn.commit()
                logger.info("Database migration successfully added 'last_login_at' to 'users'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add last_login_at column: {e}")

        # Check and dynamically add profile/preference columns if they don't exist
        for col_name, alter_sql in USERS_MIGRATIONS.items():
            try:
                conn.execute(text(f"SELECT {col_name} FROM users LIMIT 1"))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                try:
                    conn.execute(text(alter_sql))
                    conn.commit()
                    logger.info(f"Database migration successfully added '{col_name}' to 'users'.")
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to add '{col_name}' column to users: {e}")

        # 1c. Check if passkeys table has rp_id column, if not, add it
        try:
            conn.execute(text("SELECT rp_id FROM passkeys LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE passkeys ADD COLUMN rp_id VARCHAR(255) NULL"))
                conn.commit()
                logger.info("Database migration successfully added 'rp_id' to 'passkeys'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add rp_id column to passkeys: {e}")

        # 1d. Check if api_keys table has user_id and is_pairing columns, if not, add them
        try:
            conn.execute(text("SELECT user_id, is_pairing FROM api_keys LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE api_keys ADD COLUMN user_id VARCHAR(64) NULL"))
                conn.execute(text("ALTER TABLE api_keys ADD COLUMN is_pairing BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'user_id' and 'is_pairing' to 'api_keys'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add user_id/is_pairing columns to api_keys: {e}")

        # 1e. Check if sso_links table has avatar_url column, if not, add it
        try:
            conn.execute(text("SELECT avatar_url FROM sso_links LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE sso_links ADD COLUMN avatar_url VARCHAR(500) NULL"))
                conn.commit()
                logger.info("Database migration successfully added 'avatar_url' to 'sso_links'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add avatar_url column to sso_links: {e}")

        # 1f. Check if providers table has transparent_logo_bg, if not, add it
        try:
            conn.execute(text("SELECT transparent_logo_bg FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN transparent_logo_bg BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'transparent_logo_bg' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add transparent_logo_bg column to providers: {e}")

        # 1g. Check if providers table has fit_logo_to_card, if not, add it
        try:
            conn.execute(text("SELECT fit_logo_to_card FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN fit_logo_to_card BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'fit_logo_to_card' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add fit_logo_to_card column to providers: {e}")

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
        for col_name, alter_sql in LIBRARY_ENTRIES_MIGRATIONS.items():
            try:
                conn.execute(text(f"SELECT {col_name} FROM library_entries LIMIT 1"))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                try:
                    conn.execute(text(alter_sql))
                    conn.commit()
                    logger.info(f"Database migration successfully added '{col_name}' to 'library_entries'.")
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to add column {col_name} (it may already exist): {e}")

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

        # 5. Check if session_cookies has name column, if not, add it
        try:
            conn.execute(text("SELECT name FROM session_cookies LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE session_cookies ADD COLUMN name VARCHAR(255)"))
                conn.commit()
                logger.info("Database migration successfully added 'name' to 'session_cookies'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add name column to session_cookies (it may already exist): {e}")

        # 6. Check if mass_rip_sessions table exists, if not, create it
        try:
            conn.execute(text("SELECT id FROM mass_rip_sessions LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            if dialect_name == "postgresql":
                create_table_sql = """
                CREATE TABLE mass_rip_sessions (
                    id SERIAL PRIMARY KEY,
                    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
                    url TEXT NOT NULL,
                    criteria JSONB,
                    status VARCHAR(50) DEFAULT 'pending',
                    total_videos INTEGER DEFAULT 0,
                    processed_videos INTEGER DEFAULT 0,
                    queued_videos INTEGER DEFAULT 0,
                    skipped_videos INTEGER DEFAULT 0,
                    celery_task_id VARCHAR(255),
                    user_id VARCHAR(64),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            else:
                create_table_sql = """
                CREATE TABLE mass_rip_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
                    url TEXT NOT NULL,
                    criteria TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    total_videos INTEGER DEFAULT 0,
                    processed_videos INTEGER DEFAULT 0,
                    queued_videos INTEGER DEFAULT 0,
                    skipped_videos INTEGER DEFAULT 0,
                    celery_task_id VARCHAR(255),
                    user_id VARCHAR(64),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            try:
                conn.execute(text(create_table_sql))
                conn.commit()
                logger.info("Database migration successfully created 'mass_rip_sessions' table.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to create mass_rip_sessions table: {e}")

        # 7. Check if download_queue has user_id, if not, add it
        try:
            conn.execute(text("SELECT user_id FROM download_queue LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE download_queue ADD COLUMN user_id VARCHAR(64)"))
                conn.commit()
                logger.info("Database migration successfully added 'user_id' to 'download_queue'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass

        # 8. Check if mass_rip_sessions has user_id, if not, add it
        try:
            conn.execute(text("SELECT user_id FROM mass_rip_sessions LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE mass_rip_sessions ADD COLUMN user_id VARCHAR(64)"))
                conn.commit()
                logger.info("Database migration successfully added 'user_id' to 'mass_rip_sessions'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass

        # 9. Add logo_url to providers table if missing
        try:
            conn.execute(text("SELECT logo_url FROM providers LIMIT 1"))
            # If exists, alter type to TEXT if postgresql
            if dialect_name == "postgresql":
                try:
                    conn.execute(text("ALTER TABLE providers ALTER COLUMN logo_url TYPE TEXT"))
                    conn.commit()
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to alter logo_url to TEXT: {e}")
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN logo_url TEXT"))
                conn.commit()
                logger.info("Database migration successfully added 'logo_url' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add logo_url column to providers: {e}")

        # 10. Check if billers table has new columns, if not, add them
        for col_name, alter_sql in BILLERS_MIGRATIONS.items():
            try:
                conn.execute(text(f"SELECT {col_name} FROM billers LIMIT 1"))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                try:
                    conn.execute(text(alter_sql))
                    conn.commit()
                    logger.info(f"Database migration successfully added '{col_name}' to 'billers'.")
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to add column {col_name} to billers: {e}")

        # 11. Check if subscriptions table has new billing/meta columns, if not, add them
        for col_name, alter_sql in SUBSCRIPTIONS_MIGRATIONS.items():
            try:
                conn.execute(text(f"SELECT {col_name} FROM subscriptions LIMIT 1"))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                try:
                    conn.execute(text(alter_sql))
                    conn.commit()
                    logger.info(f"Database migration successfully added '{col_name}' to 'subscriptions'.")
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to add column {col_name} to subscriptions: {e}")

        # 12. Check if providers table has favicon_url column, if not, add it
        try:
            conn.execute(text("SELECT favicon_url FROM providers LIMIT 1"))
            # If exists, alter type to TEXT if postgresql
            if dialect_name == "postgresql":
                try:
                    conn.execute(text("ALTER TABLE providers ALTER COLUMN favicon_url TYPE TEXT"))
                    conn.commit()
                except Exception as e:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    logger.warning(f"Failed to alter favicon_url to TEXT: {e}")
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN favicon_url TEXT"))
                conn.commit()
                logger.info("Database migration successfully added 'favicon_url' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column favicon_url to providers: {e}")

        # 13b. Check if providers table has description column, if not, add it
        try:
            conn.execute(text("SELECT description FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN description TEXT"))
                conn.commit()
                logger.info("Database migration successfully added 'description' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column description to providers: {e}")

        # 13c. Check if providers table has default_biller_id column, if not, add it
        try:
            conn.execute(text("SELECT default_biller_id FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                if dialect_name == "postgresql":
                    conn.execute(text("ALTER TABLE providers ADD COLUMN default_biller_id INTEGER REFERENCES billers(id) ON DELETE SET NULL"))
                else:
                    conn.execute(text("ALTER TABLE providers ADD COLUMN default_biller_id INTEGER"))
                conn.commit()
                logger.info("Database migration successfully added 'default_biller_id' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column default_biller_id to providers: {e}")

        # 13d. Check if providers table has supported_methods column, if not, add it
        try:
            conn.execute(text("SELECT supported_methods FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                if dialect_name == "postgresql":
                    conn.execute(text("ALTER TABLE providers ADD COLUMN supported_methods JSONB DEFAULT '[]'::jsonb"))
                else:
                    conn.execute(text("ALTER TABLE providers ADD COLUMN supported_methods JSON DEFAULT '[]'"))
                conn.commit()
                logger.info("Database migration successfully added 'supported_methods' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column supported_methods to providers: {e}")

        # 13e. Check if providers table has transparent_logo_bg column, if not, add it
        try:
            conn.execute(text("SELECT transparent_logo_bg FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN transparent_logo_bg BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'transparent_logo_bg' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column transparent_logo_bg to providers: {e}")

        # 13f. Check if providers table has fit_logo_to_card column, if not, add it
        try:
            conn.execute(text("SELECT fit_logo_to_card FROM providers LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE providers ADD COLUMN fit_logo_to_card BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'fit_logo_to_card' to 'providers'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column fit_logo_to_card to providers: {e}")

        # 13g. Check if studios table has parent_id column, if not, add it
        try:
            conn.execute(text("SELECT parent_id FROM studios LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                if dialect_name == "postgresql":
                    conn.execute(text("ALTER TABLE studios ADD COLUMN parent_id INTEGER REFERENCES studios(id) ON DELETE SET NULL"))
                else:
                    conn.execute(text("ALTER TABLE studios ADD COLUMN parent_id INTEGER"))
                conn.commit()
                logger.info("Database migration successfully added 'parent_id' to 'studios'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column parent_id to studios: {e}")

        # 13h. Check if studios table has is_network column, if not, add it
        try:
            conn.execute(text("SELECT is_network FROM studios LIMIT 1"))
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE studios ADD COLUMN is_network BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.info("Database migration successfully added 'is_network' to 'studios'.")
            except Exception as e:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"Failed to add column is_network to studios: {e}")

        # 14. Seed default adult billers
        try:
            default_billers = [
                ("CCBill", "https://ccbill.com", "consumersupport@ccbill.com", "1-888-596-9279", "CCBill payment gateway."),
                ("Epoch", "https://epoch.com", "billing@epoch.com", "1-800-893-8871", "Epoch payment services."),
                ("Vendo", "https://vendoservices.com", "support@vendoservices.com", "1-877-327-8341", "Vendo billing."),
                ("Verotel", "https://verotel.com", "support@verotel.com", "1-877-873-0550", "Verotel billing gateway."),
                ("Segpay", "https://segpay.com", "help@segpay.com", "1-866-567-1500", "Segpay payment solutions."),
                ("Centrobill", "https://centrobill.com", "support@centrobill.com", "1-844-469-8088", "Centrobill safe payments."),
                ("Probiller", "https://probiller.com", "support@probiller.com", "1-855-232-9555", "Probiller subscription billing services."),
                ("Rocketgate", "https://rocketgate.com", "support@rocketgate.com", "1-702-997-2347", "Rocketgate high-risk payment gateway."),
                ("Netbilling", "https://netbilling.com", "support@netbilling.com", "1-888-357-8166", "Netbilling payment processing solutions."),
                ("Paxum", "https://paxum.com", "support@paxum.com", "1-866-380-2986", "Paxum e-wallet and provider payout services."),
                ("Cosmopayment", "https://cosmopayment.com", "support@cosmopayment.com", "+1-954-890-2821", "Cosmopayment global payment services."),
                ("MojoHost", "https://mojohost.com", "billing@mojohost.com", "1-877-665-6467", "MojoHost hosting and infrastructure billing.")
            ]
            for name, url, email, phone, desc in default_billers:
                if dialect_name == "postgresql":
                    query = "INSERT INTO billers (name, url, support_email, support_phone, description) VALUES (:name, :url, :email, :phone, :desc) ON CONFLICT (name) DO NOTHING"
                else:
                    query = "INSERT OR IGNORE INTO billers (name, url, support_email, support_phone, description) VALUES (:name, :url, :email, :phone, :desc)"
                conn.execute(text(query), {"name": name, "url": url, "email": email, "phone": phone, "desc": desc})
            conn.commit()
            logger.info("Database migration successfully seeded default billers.")
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning(f"Failed to seed default billers: {e}")

def is_feature_enabled(db: Session, feature: str, user: Optional[Any] = None) -> bool:
    from models import Settings
    if feature == "streaming":
        setting = db.query(Settings).filter(Settings.key == "streaming_enabled").first()
        global_enabled = (setting.value.lower() != "false") if setting else True
    elif feature == "scraping":
        setting = db.query(Settings).filter(Settings.key == "scraping_enabled").first()
        global_enabled = (setting.value.lower() != "false") if setting else True
    elif feature == "ripping":
        setting = db.query(Settings).filter(Settings.key == "ripping_enabled").first()
        global_enabled = (setting.value.lower() != "false") if setting else True
    else:
        global_enabled = True

    if not global_enabled:
        return False

    if user is not None:
        if isinstance(user, dict):
            if user.get("type") == "master_key" or user.get("role") == "admin":
                return True
        elif getattr(user, "role", None) == "admin":
            return True

        permissions = getattr(user, "permissions", None)
        permissions_dict: dict[str, Any] = {}
        if isinstance(permissions, dict):
            permissions_dict = cast(dict[str, Any], permissions)
        elif isinstance(permissions, str):
            import json
            try:
                parsed = json.loads(permissions)
                if isinstance(parsed, dict):
                    permissions_dict = cast(dict[str, Any], parsed)
            except Exception:
                pass

        if feature == "streaming":
            val = permissions_dict.get("streaming", permissions_dict.get("can_stream", "view"))
            return val in ["view", "edit"] or val is True
        elif feature == "scraping":
            val = permissions_dict.get("scraping", permissions_dict.get("can_scrape", "none"))
            return val in ["view", "edit"] or val is True
        elif feature == "ripping":
            val = permissions_dict.get("ripping", permissions_dict.get("can_rip", "none"))
            return val in ["view", "edit"] or val is True

    return True


def check_feature_permission(db: Session, feature: str, user: Optional[Any] = None) -> None:
    from fastapi import HTTPException
    if not is_feature_enabled(db, feature, user):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: the '{feature}' feature is disabled globally or you do not have permission to access it."
        )


def log_admin_action(db: Session, admin_id: Optional[str], admin_username: str, action: str, details: dict[str, Any]) -> None:
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
