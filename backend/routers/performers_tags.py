import math
from typing import Optional
from fastapi import APIRouter, Query, Body, HTTPException
from sqlalchemy import text, func
from database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session
from models import Performer, Tag

router = APIRouter(tags=["performers_tags"])


# ── Helper ──────────────────────────────────────────────────────────────────

def paginated_query(db, model, search: str, page: int, per_page: int, order_by=None):
    query = db.query(model)
    if search:
        query = query.filter(model.name.ilike(f"%{search}%"))
    total = query.count()
    if order_by is None:
        order_by = model.entry_count.desc()
    items = query.order_by(order_by, model.name.asc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [{"name": i.name, "count": i.entry_count} for i in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": math.ceil(total / per_page) if total > 0 else 0,
    }


# ── Performers ──────────────────────────────────────────────────────────────


@router.get("/performers")
def list_performers(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return paginated_query(db, Performer, q or "", page, per_page)


@router.post("/performers", status_code=201)
def create_performer(
    name: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    existing = db.query(Performer).filter(func.lower(Performer.name) == name.lower()).first()
    if existing:
        raise HTTPException(409, f"Performer '{name}' already exists.")
    p = Performer(name=name, entry_count=0)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name}


@router.put("/performers/rename")
def rename_performer(
    old_name: str = Body(...),
    new_name: str = Body(...),
    db: Session = Depends(get_db),
):
    if old_name.lower() == new_name.lower():
        raise HTTPException(400, "Old and new names are the same.")
    existing = db.query(Performer).filter(func.lower(Performer.name) == new_name.lower()).first()
    if existing:
        raise HTTPException(409, f"Performer '{new_name}' already exists.")

    db.execute(
        text("""
            UPDATE library_entries
            SET performers = (
                SELECT jsonb_agg(CASE WHEN value = :old THEN :new ELSE value END)
                FROM jsonb_array_elements_text(performers)
            )
            WHERE performers ? :old
        """),
        {"old": old_name, "new": new_name},
    )

    p = db.query(Performer).filter(Performer.name == old_name).first()
    if p:
        p.name = new_name
    db.commit()
    return {"success": True}


@router.post("/performers/merge")
def merge_performers(
    source: str = Body(...),
    target: str = Body(...),
    db: Session = Depends(get_db),
):
    if source.lower() == target.lower():
        raise HTTPException(400, "Source and target are the same.")

    # Rename source to target in JSONB
    db.execute(
        text("""
            UPDATE library_entries
            SET performers = (
                SELECT jsonb_agg(CASE WHEN value = :old THEN :new ELSE value END)
                FROM jsonb_array_elements_text(performers)
            )
            WHERE performers ? :old
        """),
        {"old": source, "new": target},
    )

    # Deduplicate arrays that now contain both
    db.execute(
        text("""
            UPDATE library_entries
            SET performers = (
                SELECT jsonb_agg(DISTINCT value)
                FROM jsonb_array_elements_text(performers)
            )
            WHERE performers ? :new
        """),
        {"new": target},
    )

    # Merge count into target, delete source
    src = db.query(Performer).filter(Performer.name == source).first()
    tgt = db.query(Performer).filter(Performer.name == target).first()
    if tgt and src:
        tgt.entry_count = (tgt.entry_count or 0) + (src.entry_count or 0)
        db.delete(src)
    db.commit()
    return {"success": True}


@router.delete("/performers/{name}")
def delete_performer(name: str, db: Session = Depends(get_db)):
    db.execute(text("UPDATE library_entries SET performers = performers - :name"), {"name": name})
    db.query(Performer).filter(Performer.name == name).delete()
    db.commit()
    return {"success": True}


# ── Tags ─────────────────────────────────────────────────────────────────────


@router.get("/tags")
def list_tags(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return paginated_query(db, Tag, q or "", page, per_page)


@router.post("/tags", status_code=201)
def create_tag(
    name: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    existing = db.query(Tag).filter(func.lower(Tag.name) == name.lower()).first()
    if existing:
        raise HTTPException(409, f"Tag '{name}' already exists.")
    t = Tag(name=name, entry_count=0)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name}


@router.put("/tags/rename")
def rename_tag(
    old_name: str = Body(...),
    new_name: str = Body(...),
    db: Session = Depends(get_db),
):
    if old_name.lower() == new_name.lower():
        raise HTTPException(400, "Old and new names are the same.")
    existing = db.query(Tag).filter(func.lower(Tag.name) == new_name.lower()).first()
    if existing:
        raise HTTPException(409, f"Tag '{new_name}' already exists.")

    db.execute(
        text("""
            UPDATE library_entries
            SET tags = (
                SELECT jsonb_agg(CASE WHEN value = :old THEN :new ELSE value END)
                FROM jsonb_array_elements_text(tags)
            )
            WHERE tags ? :old
        """),
        {"old": old_name, "new": new_name},
    )

    t = db.query(Tag).filter(Tag.name == old_name).first()
    if t:
        t.name = new_name
    db.commit()
    return {"success": True}


@router.post("/tags/merge")
def merge_tags(
    source: str = Body(...),
    target: str = Body(...),
    db: Session = Depends(get_db),
):
    if source.lower() == target.lower():
        raise HTTPException(400, "Source and target are the same.")

    db.execute(
        text("""
            UPDATE library_entries
            SET tags = (
                SELECT jsonb_agg(CASE WHEN value = :old THEN :new ELSE value END)
                FROM jsonb_array_elements_text(tags)
            )
            WHERE tags ? :old
        """),
        {"old": source, "new": target},
    )

    db.execute(
        text("""
            UPDATE library_entries
            SET tags = (
                SELECT jsonb_agg(DISTINCT value)
                FROM jsonb_array_elements_text(tags)
            )
            WHERE tags ? :new
        """),
        {"new": target},
    )

    src = db.query(Tag).filter(Tag.name == source).first()
    tgt = db.query(Tag).filter(Tag.name == target).first()
    if tgt and src:
        tgt.entry_count = (tgt.entry_count or 0) + (src.entry_count or 0)
        db.delete(src)
    db.commit()
    return {"success": True}


@router.delete("/tags/{name}")
def delete_tag(name: str, db: Session = Depends(get_db)):
    db.execute(text("UPDATE library_entries SET tags = tags - :name"), {"name": name})
    db.query(Tag).filter(Tag.name == name).delete()
    db.commit()
    return {"success": True}
