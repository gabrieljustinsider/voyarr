import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
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
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
