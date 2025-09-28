from contextlib import contextmanager
from database import SessionLocal
from typing import Optional


@contextmanager
def get_db_session():
    db = SessionLocal()
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
