import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# If DATABASE_URL is missing or contains unresolved 1Password references (op://), load local dev env
db_url = os.getenv("DATABASE_URL")
if not db_url or db_url.startswith("op://"):
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env.dev.local"), override=True)
    db_url = os.getenv("DATABASE_URL")

if not db_url or db_url.startswith("op://"):
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env.portainer"), override=True)
    db_url = os.getenv("DATABASE_URL")

if not db_url or db_url.startswith("op://"):
    db_user = os.getenv("POSTGRES_USER") or "voyarr_user"
    db_pass = os.getenv("POSTGRES_PASSWORD") or "password"
    db_host = os.getenv("POSTGRES_HOST") or "db"
    db_port = os.getenv("POSTGRES_PORT") or "5432"
    db_name = os.getenv("POSTGRES_DB") or "voyarr"
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

DATABASE_URL = db_url

# Dialect-aware connection pooling to optimize performance and prevent starvation
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "15")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "15")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "60")),
        pool_pre_ping=True,
        connect_args={
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5
        } if not DATABASE_URL.startswith("sqlite") else {}
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
