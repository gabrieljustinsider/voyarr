from celery import shared_task
from database import SessionLocal
from models import MediaEntry, DownloadQueue

@shared_task
def cleanup_abandoned_media():
    db = SessionLocal()
    try:
        # Find all MediaEntry IDs currently referenced by the download queue
        active_media_ids = db.query(DownloadQueue.media_entry_id).filter(
            DownloadQueue.media_entry_id.isnot(None)
        )
        
        # Identify MediaEntries not present in the active queue
        dangling_media = db.query(MediaEntry).filter(MediaEntry.id.notin_(active_media_ids)).all()
        
        count = len(dangling_media)
        for media in dangling_media:
            db.delete(media)
            
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()