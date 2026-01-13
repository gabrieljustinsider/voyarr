from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import VideoChapter, LibraryEntry
from schemas import VideoChapterCreate, VideoChapterUpdate, VideoChapterResponse
from dependencies import verify_api_key

router = APIRouter(
    prefix="/chapters", tags=["chapters"], dependencies=[Depends(verify_api_key)]
)


@router.get("/library/{library_entry_id}", response_model=List[VideoChapterResponse])
def get_chapters_for_entry(library_entry_id: int, db: Session = Depends(get_db)):
    # Verify library entry exists
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    chapters = (
        db.query(VideoChapter)
        .filter(VideoChapter.library_entry_id == library_entry_id)
        .order_by(VideoChapter.start_time)
        .all()
    )
    return chapters


@router.post("/library/{library_entry_id}", response_model=VideoChapterResponse)
def create_chapter(
    library_entry_id: int, chapter: VideoChapterCreate, db: Session = Depends(get_db)
):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    new_chapter = VideoChapter(
        library_entry_id=library_entry_id,
        title=chapter.title,
        start_time=chapter.start_time,
        end_time=chapter.end_time,
        tags=chapter.tags,
    )
    db.add(new_chapter)
    entry.has_chapters = True
    db.commit()
    db.refresh(new_chapter)
    return new_chapter


@router.put("/{chapter_id}", response_model=VideoChapterResponse)
def update_chapter(
    chapter_id: int, chapter: VideoChapterUpdate, db: Session = Depends(get_db)
):
    db_chapter = db.query(VideoChapter).filter(VideoChapter.id == chapter_id).first()
    if not db_chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    update_data = chapter.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chapter, key, value)

    db.commit()
    db.refresh(db_chapter)
    return db_chapter


@router.delete("/{chapter_id}")
def delete_chapter(chapter_id: int, db: Session = Depends(get_db)):
    db_chapter = db.query(VideoChapter).filter(VideoChapter.id == chapter_id).first()
    if not db_chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    entry_id = db_chapter.library_entry_id
    db.delete(db_chapter)
    db.commit()

    # Reset has_chapters flag if no chapters remain
    remaining = db.query(VideoChapter).filter(VideoChapter.library_entry_id == entry_id).count()
    if remaining == 0:
        entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
        if entry:
            entry.has_chapters = False
            db.commit()

    return {"message": "Chapter deleted successfully"}


@router.post("/library/{library_entry_id}/auto-chapter")
def trigger_auto_chaptering(library_entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    from tasks.ai_tasks import generate_video_chapters_task

    task = generate_video_chapters_task.delay(entry.id)
    return {"message": "Auto-chaptering task queued", "task_id": task.id}
