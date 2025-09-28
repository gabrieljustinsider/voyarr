from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, UserHistory, UserVideoStats, Favorite, LibraryEntry
from routers.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve aggregate statistics, top charts, and time series activity for dashboards."""
    # Aggregates
    total_watch_seconds = db.query(func.sum(UserHistory.duration)).scalar() or 0
    total_plays = db.query(func.sum(UserVideoStats.play_count)).scalar() or 0
    total_climaxes = db.query(func.sum(UserVideoStats.climax_count)).scalar() or 0

    # Convert watch seconds to hours for dashboard friendly units
    total_watch_hours = round(total_watch_seconds / 3600.0, 2)

    # Activity Timeline (last 14 days)
    two_weeks_ago = datetime.now(timezone.utc) - timedelta(days=14)
    timeline_data = (
        db.query(
            func.date(UserHistory.watched_at).label("day"),
            func.count(UserHistory.id).label("plays"),
            func.sum(UserHistory.duration).label("duration"),
        )
        .filter(UserHistory.watched_at >= two_weeks_ago)
        .group_by(func.date(UserHistory.watched_at))
        .order_by(func.date(UserHistory.watched_at).asc())
        .all()
    )

    activity_timeline = []
    for t in timeline_data:
        activity_timeline.append(
            {
                "date": str(t.day),
                "plays": t.plays,
                "watch_minutes": round((t.duration or 0) / 60.0, 2),
            }
        )

    # Top Favorited Scenes
    top_scenes = (
        db.query(Favorite.item_id, func.count(Favorite.id).label("fav_count"))
        .filter(Favorite.item_type == "scene")
        .group_by(Favorite.item_id)
        .order_by(func.count(Favorite.id).desc())
        .limit(5)
        .all()
    )

    top_scenes_list = []
    for ts in top_scenes:
        try:
            entry_id = int(ts.item_id)
            entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
            title = entry.title if entry else f"Scene ID {entry_id}"
        except ValueError:
            title = ts.item_id

        top_scenes_list.append(
            {"item_id": ts.item_id, "title": title, "count": ts.fav_count}
        )

    # Top Favorited Performers
    top_performers = (
        db.query(Favorite.item_id, func.count(Favorite.id).label("fav_count"))
        .filter(Favorite.item_type == "performer")
        .group_by(Favorite.item_id)
        .order_by(func.count(Favorite.id).desc())
        .limit(5)
        .all()
    )

    top_performers_list = [
        {"name": tp.item_id, "count": tp.fav_count} for tp in top_performers
    ]

    return {
        "metrics": {
            "total_watch_hours": total_watch_hours,
            "total_plays": int(total_plays),
            "total_climax_count": int(total_climaxes),
        },
        "activity_timeline": activity_timeline,
        "top_scenes": top_scenes_list,
        "top_performers": top_performers_list,
    }


@router.get("/report")
def get_detailed_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve detailed raw system analytics report (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are authorized to generate system reports.",
        )

    # Compile a detailed breakdown of user play counts and climaxes per library entry
    video_breakdowns = (
        db.query(
            UserVideoStats.library_entry_id,
            UserVideoStats.play_count,
            UserVideoStats.climax_count,
            UserVideoStats.last_played,
            User.username,
        )
        .join(User, User.id == UserVideoStats.user_id)
        .order_by(UserVideoStats.last_played.desc())
        .all()
    )

    report_entries = []
    for vb in video_breakdowns:
        entry = (
            db.query(LibraryEntry)
            .filter(LibraryEntry.id == vb.library_entry_id)
            .first()
        )
        title = entry.title if entry else f"Deleted Video ID {vb.library_entry_id}"

        report_entries.append(
            {
                "username": vb.username,
                "video_id": vb.library_entry_id,
                "title": title,
                "play_count": vb.play_count,
                "climax_count": vb.climax_count,
                "last_played": vb.last_played.isoformat() if vb.last_played else None,
            }
        )

    # Compile recent watch history sessions
    recent_history = (
        db.query(
            UserHistory.id,
            UserHistory.watched_at,
            UserHistory.duration,
            UserHistory.completed,
            User.username,
            UserHistory.library_entry_id,
        )
        .join(User, User.id == UserHistory.user_id)
        .order_by(UserHistory.watched_at.desc())
        .limit(100)
        .all()
    )

    history_entries = []
    for rh in recent_history:
        entry = (
            db.query(LibraryEntry)
            .filter(LibraryEntry.id == rh.library_entry_id)
            .first()
        )
        title = entry.title if entry else f"Deleted Video ID {rh.library_entry_id}"

        history_entries.append(
            {
                "history_id": rh.id,
                "username": rh.username,
                "title": title,
                "watched_at": rh.watched_at.isoformat() if rh.watched_at else None,
                "duration_seconds": rh.duration,
                "completed": rh.completed,
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "video_stats_breakdown": report_entries,
        "recent_watch_logs": history_entries,
    }
