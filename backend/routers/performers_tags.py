import math
from typing import Optional
from fastapi import APIRouter, Query
from sqlalchemy import text
from database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session

router = APIRouter(tags=["performers_tags"])


def get_distinct_values(db: Session, column: str, search: str = "", page: int = 1, per_page: int = 20):
    query = f"""
        SELECT value AS name, COUNT(*) AS count
        FROM (
            SELECT jsonb_array_elements_text({column}) AS value
            FROM library_entries
            WHERE {column} IS NOT NULL AND jsonb_array_length({column}) > 0
        ) sub
    """
    count_query = f"SELECT COUNT(*) FROM ({query}) sub2"
    params: dict = {}

    if search:
        query += " WHERE value ILIKE :search"
        params["search"] = f"%{search}%"

    query += " GROUP BY value ORDER BY count DESC, value ASC"

    total = db.execute(text(count_query), params).scalar() or 0

    offset = (page - 1) * per_page
    query += " LIMIT :limit OFFSET :offset"
    params["limit"] = per_page
    params["offset"] = offset

    rows = db.execute(text(query), params).all()

    return {
        "items": [{"name": r.name, "count": r.count} for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": math.ceil(total / per_page) if total > 0 else 0,
    }


@router.get("/performers")
def list_performers(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_distinct_values(db, "performers", search=q or "", page=page, per_page=per_page)


@router.get("/tags")
def list_tags(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_distinct_values(db, "tags", search=q or "", page=page, per_page=per_page)
