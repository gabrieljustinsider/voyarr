from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Studio, User
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/studios", tags=["studios"])

class StudioCreateUpdate(BaseModel):
    name: str
    logo_url: Optional[str] = None
    url: Optional[str] = None
    details: Optional[str] = None
    tags: List[str] = []
    is_network: bool = False
    parent_id: Optional[int] = None


@router.get("")
def list_studios(q: Optional[str] = None, db: Session = Depends(get_db)):
    """List all studios, optionally filtered by a search query."""
    query = db.query(Studio)
    if q:
        query = query.filter(Studio.name.ilike(f"%{q}%"))
    studios = query.order_by(Studio.name.asc()).all()

    result = []
    for s in studios:
        parent_name = None
        if s.parent_id:
            parent = db.query(Studio).filter(Studio.id == s.parent_id).first()
            if parent:
                parent_name = parent.name

        result.append({
            "id": s.id,
            "name": s.name,
            "logo_url": s.logo_url,
            "url": s.url,
            "details": s.details,
            "tags": s.tags or [],
            "is_network": s.is_network,
            "parent_id": s.parent_id,
            "parent_name": parent_name
        })
    return result


@router.get("/{studio_id}")
def get_studio(studio_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific studio."""
    s = db.query(Studio).filter(Studio.id == studio_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Studio not found"
        )

    parent_name = None
    if s.parent_id:
        parent = db.query(Studio).filter(Studio.id == s.parent_id).first()
        if parent:
            parent_name = parent.name

    return {
        "id": s.id,
        "name": s.name,
        "logo_url": s.logo_url,
        "url": s.url,
        "details": s.details,
        "tags": s.tags or [],
        "is_network": s.is_network,
        "parent_id": s.parent_id,
        "parent_name": parent_name
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_studio(
    req: StudioCreateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new studio profile (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage studio configurations.",
        )

    # Check for name collisions
    existing = db.query(Studio).filter(Studio.name.ilike(req.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A studio named '{req.name}' already exists."
        )

    if req.parent_id:
        parent = db.query(Studio).filter(Studio.id == req.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The specified parent studio does not exist."
            )

    s = Studio(
        name=req.name,
        logo_url=req.logo_url,
        url=req.url,
        details=req.details,
        tags=req.tags,
        is_network=req.is_network,
        parent_id=req.parent_id
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{studio_id}")
def update_studio(
    studio_id: int,
    req: StudioCreateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing studio profile (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage studio configurations.",
        )

    s = db.query(Studio).filter(Studio.id == studio_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Studio not found"
        )

    # Check name collisions (if name changed)
    if s.name.lower() != req.name.lower():
        existing = db.query(Studio).filter(Studio.name.ilike(req.name)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A studio named '{req.name}' already exists."
            )

    # Prevent self-referential parent loops
    if req.parent_id == studio_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A studio cannot be its own parent network."
        )

    if req.parent_id:
        parent = db.query(Studio).filter(Studio.id == req.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The specified parent studio does not exist."
            )

    s.name = req.name
    s.logo_url = req.logo_url
    s.url = req.url
    s.details = req.details
    s.tags = req.tags
    s.is_network = req.is_network
    s.parent_id = req.parent_id

    db.commit()
    db.refresh(s)
    return s


@router.delete("/{studio_id}")
def delete_studio(
    studio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a studio profile (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage studio configurations.",
        )

    s = db.query(Studio).filter(Studio.id == studio_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Studio not found"
        )

    db.delete(s)
    db.commit()
    return {"message": "Studio profile deleted successfully."}
