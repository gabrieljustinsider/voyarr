from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserHistory, UserVideoStats, UserPreference, LibraryEntry
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter(prefix="/user/stats", tags=["user_stats"])

class PlayLogRequest(BaseModel):
    library_entry_id: int
    duration: int = 0
    completed: bool = False

class ClimaxRequest(BaseModel):
    library_entry_id: int

class PreferencesRequest(BaseModel):
    theme: str
    ui_config: Dict[str, Any]


@router.post("/play")
def log_play(
    req: PlayLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a playback session and increment play count."""
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == req.library_entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Library entry not found"
        )

    # 1. Add to UserHistory
    hist = UserHistory(
        user_id=current_user.id,
        library_entry_id=req.library_entry_id,
        duration=req.duration,
        completed=req.completed
    )
    db.add(hist)

    # 2. Update/create UserVideoStats
    stats = (
        db.query(UserVideoStats)
        .filter(
            UserVideoStats.user_id == current_user.id,
            UserVideoStats.library_entry_id == req.library_entry_id,
        )
        .first()
    )

    if stats:
        stats.play_count += 1
    else:
        stats = UserVideoStats(
            user_id=current_user.id,
            library_entry_id=req.library_entry_id,
            play_count=1,
            climax_count=0
        )
        db.add(stats)

    db.commit()
    return {
        "play_count": stats.play_count,
        "climax_count": stats.climax_count,
        "message": "Play session successfully logged.",
    }


@router.post("/climax")
def log_climax(
    req: ClimaxRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a climax/orgasm (O-Meter) click, incrementing the counter."""
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == req.library_entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Library entry not found"
        )

    stats = (
        db.query(UserVideoStats)
        .filter(
            UserVideoStats.user_id == current_user.id,
            UserVideoStats.library_entry_id == req.library_entry_id,
        )
        .first()
    )

    if stats:
        stats.climax_count += 1
    else:
        stats = UserVideoStats(
            user_id=current_user.id,
            library_entry_id=req.library_entry_id,
            play_count=0,
            climax_count=1
        )
        db.add(stats)

    db.commit()
    return {
        "climax_count": stats.climax_count,
        "play_count": stats.play_count,
        "message": "Climax logged successfully!",
    }


@router.get("/video/{library_entry_id}")
def get_video_stats(
    library_entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve play counts, climax counts, and watch history for a specific video."""
    stats = (
        db.query(UserVideoStats)
        .filter(
            UserVideoStats.user_id == current_user.id,
            UserVideoStats.library_entry_id == library_entry_id,
        )
        .first()
    )

    history = (
        db.query(UserHistory)
        .filter(
            UserHistory.user_id == current_user.id,
            UserHistory.library_entry_id == library_entry_id,
        )
        .order_by(UserHistory.watched_at.desc())
        .all()
    )

    return {
        "play_count": stats.play_count if stats else 0,
        "climax_count": stats.climax_count if stats else 0,
        "history": [
            {
                "id": h.id,
                "watched_at": h.watched_at,
                "duration": h.duration,
                "completed": h.completed,
            }
            for h in history
        ],
    }


@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve theme and interface preferences for the current user."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        # Default preferences
        return {
            "theme": "dark",
            "ui_config": {
                "showFavorites": True,
                "showStudios": True,
                "showAnalytics": True,
                "showLive": True,
            },
        }
    return {"theme": pref.theme, "ui_config": pref.ui_config or {}}


@router.post("/preferences")
def update_preferences(
    req: PreferencesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update custom theme and show/hide layout items config for the user."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if pref:
        pref.theme = req.theme
        pref.ui_config = req.ui_config
    else:
        pref = UserPreference(
            user_id=current_user.id, theme=req.theme, ui_config=req.ui_config
        )
        db.add(pref)

    db.commit()
    return {"theme": pref.theme, "ui_config": pref.ui_config, "message": "Preferences updated successfully."}
