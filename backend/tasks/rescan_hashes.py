import os
import sys

# Ensure backend directory is in the python path to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_
from models import LibraryEntry
from services.hash_service import HashService
from db_utils import get_db_session


def rescan_missing_hashes():
    """
    Scans the database for LibraryEntries missing either an ohash or phash
    and attempts to regenerate them based on the local file.
    """
    from sqlalchemy.orm import defer

    with get_db_session() as db:
        print("Scanning for library entries with missing hashes...")

        # OPTIMIZATION: Use yield_per and defer to prevent N+1 queries and memory bloat
        entries = (
            db.query(LibraryEntry)
            .options(
                defer(LibraryEntry.entry_metadata),
                defer(LibraryEntry.performers),
                defer(LibraryEntry.tags),
            )
            .filter(
                or_(
                    LibraryEntry.ohash.is_(None),
                    LibraryEntry.ohash == "",
                    LibraryEntry.phash.is_(None),
                    LibraryEntry.phash == "",
                )
            )
            .yield_per(50)
        )

        found_any = False
        for entry in entries:
            found_any = True
            if not os.path.exists(entry.file_path):
                print(
                    f"File missing on disk for entry #{entry.id} ({entry.title}), skipping."
                )
                continue

            updated = False

            if not entry.ohash or entry.ohash == "":
                print(f"Generating ohash for {entry.file_path}...")
                try:
                    entry.ohash = HashService.generate_ohash(entry.file_path)
                    updated = True
                except Exception as e:
                    print(f"Failed to generate ohash: {e}")

            if not entry.phash or entry.phash == "":
                print(f"Generating phash for {entry.file_path}...")
                try:
                    entry.phash = HashService.generate_phash(entry.file_path)
                    updated = True
                except Exception as e:
                    print(f"Failed to generate phash: {e}")

            if updated:
                db.commit()
                print(f"Successfully updated hashes for entry #{entry.id}.")

        if not found_any:
            print("No entries with missing hashes found. Your library is fully hashed!")

    print("Finished rescanning hashes.")


if __name__ == "__main__":
    rescan_missing_hashes()
