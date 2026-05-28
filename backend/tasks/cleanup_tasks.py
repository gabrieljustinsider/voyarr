from celery import shared_task  # type: ignore
from celery.schedules import crontab  # type: ignore
from celery_app import celery_app
from models import MediaEntry, DownloadQueue, LibraryEntry
from db_utils import get_db_session
import os
import shutil
from utils import get_media_roots
from celery_utils import single_instance_task
from typing import Any


@celery_app.on_after_configure.connect  # type: ignore
def setup_periodic_tasks(sender: Any, **kwargs: Any) -> None:
    # Schedule the cleanup task to run automatically every night at midnight
    sender.add_periodic_task(
        crontab(hour=0, minute=0),
        cleanup_abandoned_media.s(),  # type: ignore
        name="Nightly abandoned media and orphaned face/HLS directory cleanup",
    )


@shared_task
@single_instance_task(timeout_seconds=3600)
def cleanup_abandoned_media() -> None:
    with get_db_session() as db:
        # Find all MediaEntry IDs currently referenced by the download queue
        active_media_ids = db.query(DownloadQueue.media_entry_id).filter(
            DownloadQueue.media_entry_id.isnot(None)
        )

        # PERFORMANCE: Perform a bulk delete in the database instead of loading everything into memory
        # BUGFIX: Added the missing db.commit() so the records actually get deleted
        db.query(MediaEntry).filter(MediaEntry.id.notin_(active_media_ids)).delete(
            synchronize_session=False
        )
        db.commit()

        # Clean up orphaned .faces_ directories for deleted library videos
        try:
            media_roots = get_media_roots()
            for root_dir in media_roots:
                if not os.path.exists(root_dir):
                    continue

                for dirpath, dirnames, _ in os.walk(root_dir):
                    for dirname in dirnames:
                        full_path = os.path.join(dirpath, dirname)

                        # SECURITY: Ignore symlinks to prevent arbitrary deletion outside media roots
                        if os.path.islink(full_path):
                            continue

                        if dirname.startswith(".faces_"):
                            try:
                                entry_id = int(dirname.split("_")[1])
                                entry = (
                                    db.query(LibraryEntry)
                                    .filter(LibraryEntry.id == entry_id)
                                    .first()
                                )
                                if not entry:
                                    shutil.rmtree(full_path)
                                    print(
                                        f"Cleaned up orphaned face directory: {full_path}"
                                    )
                            except (ValueError, IndexError):
                                continue
                        elif dirname.endswith(".hls"):
                            # If the base video file no longer exists, the HLS directory is orphaned
                            base_file = dirname[:-4]
                            original_file_path = os.path.join(dirpath, base_file)
                            if not os.path.exists(original_file_path):
                                shutil.rmtree(full_path)
                                print(f"Cleaned up orphaned HLS directory: {full_path}")
        except Exception as e:
            print(f"Error cleaning up orphaned directories: {e}")
