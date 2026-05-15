from celery import shared_task
import os
from models import LibraryEntry, DuplicateEntry
from db_utils import get_db_session
from celery_utils import single_instance_task

try:
    import imagehash
except ImportError:
    imagehash = None


def merge_duplicate_pair(db, keep_id: int, delete_id: int):
    """
    Merges metadata from delete_id into keep_id, deletes the physical file of delete_id,
    and removes the delete_id from the database.
    """
    keep_entry = db.query(LibraryEntry).filter(LibraryEntry.id == keep_id).first()
    delete_entry = db.query(LibraryEntry).filter(LibraryEntry.id == delete_id).first()

    if not keep_entry or not delete_entry:
        raise ValueError("One or both entries not found")

    # Merge metadata
    # 1. Tags
    keep_tags = set(keep_entry.tags or [])
    delete_tags = set(delete_entry.tags or [])
    keep_entry.tags = list(keep_tags.union(delete_tags))

    # 2. Performers
    keep_performers = set(keep_entry.performers or [])
    delete_performers = set(delete_entry.performers or [])
    keep_entry.performers = list(keep_performers.union(delete_performers))

    # 3. Studio
    if not keep_entry.studio_id and delete_entry.studio_id:
        keep_entry.studio_id = delete_entry.studio_id

    # 4. JSON metadata (shallow merge)
    keep_meta = dict(keep_entry.entry_metadata or {})
    delete_meta = delete_entry.entry_metadata or {}
    for k, v in delete_meta.items():
        if k not in keep_meta or keep_meta[k] is None:
            keep_meta[k] = v
    keep_entry.entry_metadata = keep_meta

    # Delete physical file
    if delete_entry.file_path and os.path.exists(delete_entry.file_path):
        try:
            os.remove(delete_entry.file_path)
        except Exception as e:
            print(f"Warning: could not delete file {delete_entry.file_path}: {e}")

    # Delete database record
    db.delete(delete_entry)
    db.commit()

    return True


@shared_task
@single_instance_task(timeout_seconds=3600)
def scan_for_duplicates():
    """
    Iterates through the library comparing perceptual hashes.
    Populates the duplicate_entries table for user review.
    """
    if not imagehash:
        print("imagehash library not installed. Skipping duplicate scan.")
        return

    with get_db_session() as db:
        # OPTIMIZATION: Fetch only the scalar columns needed to bypass JSON overhead and save massive amounts of RAM
        entries = (
            db.query(LibraryEntry.id, LibraryEntry.phash)
            .filter(LibraryEntry.phash.isnot(None), LibraryEntry.phash != "")
            .all()
        )

        new_dupes = 0
        for i, entry1 in enumerate(entries):
            for entry2 in entries[i + 1 :]:
                # Check if this pair was already evaluated
                existing = (
                    db.query(DuplicateEntry.id)
                    .filter(
                        (
                            (DuplicateEntry.library_entry_id1 == entry1.id)
                            & (DuplicateEntry.library_entry_id2 == entry2.id)
                        )
                        | (
                            (DuplicateEntry.library_entry_id1 == entry2.id)
                            & (DuplicateEntry.library_entry_id2 == entry1.id)
                        )
                    )
                    .first()
                )

                if existing:
                    continue

                try:
                    hash1 = imagehash.hex_to_hash(entry1.phash)
                    hash2 = imagehash.hex_to_hash(entry2.phash)

                    # 64-bit hash max difference is 64
                    diff = hash1 - hash2
                    similarity = max(0, 100 - (diff * 100 / 64))

                    # 85% similarity is usually a match for different resolutions/watermarks
                    if similarity >= 85.0:
                        dupe = DuplicateEntry(
                            library_entry_id1=entry1.id,
                            library_entry_id2=entry2.id,
                            similarity_score=similarity,
                            reason="Similar visual phash",
                        )
                        db.add(dupe)
                        new_dupes += 1
                except Exception as e:
                    print(
                        f"Error comparing hashes for entries {entry1.id} and {entry2.id}: {e}"
                    )
                    continue

        print(f"Duplicate scan complete. Found {new_dupes} potential duplicates.")
