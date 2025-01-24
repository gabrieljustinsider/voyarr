from celery import shared_task
from models import MediaEntry, DownloadQueue
from db_utils import get_db_session


@shared_task
def cleanup_abandoned_media():
    with get_db_session() as db:
        # Find all MediaEntry IDs currently referenced by the download queue
        active_media_ids = db.query(DownloadQueue.media_entry_id).filter(
            DownloadQueue.media_entry_id.isnot(None)
        )

        # Identify MediaEntries not present in the active queue
        dangling_media = (
            db.query(MediaEntry).filter(MediaEntry.id.notin_(active_media_ids)).all()
        )

        for media in dangling_media:
            db.delete(media)
