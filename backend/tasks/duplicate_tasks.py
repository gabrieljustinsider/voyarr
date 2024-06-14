from celery import shared_task
from database import SessionLocal
from models import LibraryEntry, DuplicateEntry
from sqlalchemy import func
import imagehash

@shared_task
def scan_for_duplicates():
    db = SessionLocal()
    try:
        # 1. Exact matches via ohash
        ohash_duplicates = db.query(LibraryEntry.ohash).filter(
            LibraryEntry.ohash.isnot(None), 
            LibraryEntry.ohash != "",
            LibraryEntry.ohash != "0000000000000000"
        ).group_by(LibraryEntry.ohash).having(func.count(LibraryEntry.id) > 1).all()
        
        for (ohash_val,) in ohash_duplicates:
            entries = db.query(LibraryEntry).filter(LibraryEntry.ohash == ohash_val).all()
            for i in range(len(entries)):
                for j in range(i + 1, len(entries)):
                    existing = db.query(DuplicateEntry).filter(
                        ((DuplicateEntry.library_entry_id1 == entries[i].id) & (DuplicateEntry.library_entry_id2 == entries[j].id)) |
                        ((DuplicateEntry.library_entry_id1 == entries[j].id) & (DuplicateEntry.library_entry_id2 == entries[i].id))
                    ).first()
                    
                    if not existing:
                        dupe = DuplicateEntry(
                            library_entry_id1=entries[i].id,
                            library_entry_id2=entries[j].id,
                            similarity_score=100.0,
                            reason="same_ohash"
                        )
                        db.add(dupe)
        db.commit()

        # 2. Visual similarity matches via phash
        entries_with_phash = db.query(LibraryEntry).filter(
            LibraryEntry.phash.isnot(None), 
            LibraryEntry.phash != ""
        ).all()
        
        for i in range(len(entries_with_phash)):
            for j in range(i + 1, len(entries_with_phash)):
                try:
                    hash1 = imagehash.hex_to_hash(entries_with_phash[i].phash)
                    hash2 = imagehash.hex_to_hash(entries_with_phash[j].phash)
                    
                    # Compute similarity (Difference ratio from a 64-bit hash)
                    diff = hash1 - hash2
                    similarity = max(0, 100.0 - (diff / 64.0) * 100.0)
                    
                    if similarity >= 90.0:
                        existing = db.query(DuplicateEntry).filter(
                            ((DuplicateEntry.library_entry_id1 == entries_with_phash[i].id) & (DuplicateEntry.library_entry_id2 == entries_with_phash[j].id)) |
                            ((DuplicateEntry.library_entry_id1 == entries_with_phash[j].id) & (DuplicateEntry.library_entry_id2 == entries_with_phash[i].id))
                        ).first()
                        
                        if not existing:
                            dupe = DuplicateEntry(
                                library_entry_id1=entries_with_phash[i].id,
                                library_entry_id2=entries_with_phash[j].id,
                                similarity_score=similarity,
                                reason="similar_phash"
                            )
                            db.add(dupe)
                except Exception:
                    pass
        db.commit()

    except Exception as e:
        db.rollback()
        print(f"Error scanning duplicates: {e}")
    finally:
        db.close()