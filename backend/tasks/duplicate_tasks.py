from celery import shared_task
from database import SessionLocal
from models import LibraryEntry, DuplicateEntry

try:
    import imagehash
except ImportError:
    imagehash = None

@shared_task
def scan_for_duplicates():
    """
    Iterates through the library comparing perceptual hashes.
    Populates the duplicate_entries table for user review.
    """
    if not imagehash:
        print("imagehash library not installed. Skipping duplicate scan.")
        return
        
    db = SessionLocal()
    try:
        entries = db.query(LibraryEntry).filter(
            LibraryEntry.phash.isnot(None), 
            LibraryEntry.phash != ""
        ).all()
        
        new_dupes = 0
        for i, entry1 in enumerate(entries):
            for entry2 in entries[i+1:]:
                # Check if this pair was already evaluated
                existing = db.query(DuplicateEntry.id).filter(
                    ((DuplicateEntry.library_entry_id1 == entry1.id) & (DuplicateEntry.library_entry_id2 == entry2.id)) |
                    ((DuplicateEntry.library_entry_id1 == entry2.id) & (DuplicateEntry.library_entry_id2 == entry1.id))
                ).first()
                
                if existing:
                    continue
                    
                hash1 = imagehash.hex_to_hash(entry1.phash)
                hash2 = imagehash.hex_to_hash(entry2.phash)
                
                # 64-bit hash max difference is 64
                diff = hash1 - hash2
                similarity = max(0, 100 - (diff * 100 / 64))
                
                # 85% similarity is usually a match for different resolutions/watermarks
                if similarity >= 85.0:
                    dupe = DuplicateEntry(library_entry_id1=entry1.id, library_entry_id2=entry2.id, similarity_score=similarity, reason="Similar visual phash")
                    db.add(dupe)
                    new_dupes += 1
        db.commit()
        print(f"Duplicate scan complete. Found {new_dupes} potential duplicates.")
    finally:
        db.close()