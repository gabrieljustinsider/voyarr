import os
import sys

# Ensure backend directory is in the python path to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_
from database import SessionLocal
from models import LibraryEntry
from services.hash_service import HashService

def rescan_missing_hashes():
    """
    Scans the database for LibraryEntries missing either an ohash or phash
    and attempts to regenerate them based on the local file.
    """
    db = SessionLocal()
    print("Scanning for library entries with missing hashes...")
    
    # Find entries missing either ohash or phash
    entries = db.query(LibraryEntry).filter(
        or_(LibraryEntry.ohash.is_(None), LibraryEntry.phash.is_(None))
    ).all()
    
    if not entries:
        print("No entries with missing hashes found. Your library is fully hashed!")
        db.close()
        return

    print(f"Found {len(entries)} entries missing hashes. Processing...")
    
    for entry in entries:
        if not os.path.exists(entry.file_path):
            print(f"File missing on disk for entry #{entry.id} ({entry.title}), skipping.")
            continue
        
        updated = False
        
        if not entry.ohash:
            print(f"Generating ohash for {entry.file_path}...")
            try:
                entry.ohash = HashService.generate_ohash(entry.file_path)
                updated = True
            except Exception as e:
                print(f"Failed to generate ohash: {e}")
            
        if not entry.phash:
            print(f"Generating phash for {entry.file_path}...")
            try:
                entry.phash = HashService.generate_phash(entry.file_path)
                updated = True
            except Exception as e:
                print(f"Failed to generate phash: {e}")
            
        if updated:
            db.commit()
            print(f"Successfully updated hashes for entry #{entry.id}.")
            
    db.close()
    print("Finished rescanning hashes.")

if __name__ == "__main__":
    rescan_missing_hashes()