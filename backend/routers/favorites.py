from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Favorite, User
from routers.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/favorites", tags=["favorites"])


class ToggleFavoriteRequest(BaseModel):
    item_type: (
        str  # 'scene', 'video', 'performer', 'movie', 'category', 'tag', 'studio'
    )
    item_id: str


@router.post("/toggle")
def toggle_favorite(
    req: ToggleFavoriteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle a favorite item for the current authenticated user."""
    # Normalize item_type
    item_type = req.item_type.lower().strip()
    if item_type not in [
        "scene",
        "video",
        "performer",
        "movie",
        "category",
        "tag",
        "studio",
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid favorite item_type: {req.item_type}",
        )

    # Check if exists
    fav = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == current_user.id,
            Favorite.item_type == item_type,
            Favorite.item_id == req.item_id,
        )
        .first()
    )

    if fav:
        db.delete(fav)
        db.commit()
        return {"favorited": False, "message": "Removed from favorites."}
    else:
        new_fav = Favorite(
            user_id=current_user.id, item_type=item_type, item_id=req.item_id
        )
        db.add(new_fav)
        db.commit()
        return {"favorited": True, "message": "Added to favorites."}


@router.get("")
def get_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all favorites for the current user, grouped by type."""
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()

    result = {
        "scene": [],
        "video": [],
        "performer": [],
        "movie": [],
        "category": [],
        "tag": [],
        "studio": [],
    }

    for f in favs:
        if f.item_type in result:
            result[f.item_type].append(f.item_id)

    return result
