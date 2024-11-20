import os
import re
from celery import shared_task
from database import SessionLocal
from models import LibraryEntry, Provider
from services.hash_service import HashService
from services.media_tagger import MediaTagger


@shared_task
def scan_library_task(directory: str, provider_id: int):
    """
    Scans a local directory, reverse-engineers metadata from filenames
    using the Provider's naming pattern, calculates hashes, and saves to DB.
    """
    db = SessionLocal()
    try:
        provider = db.query(Provider).filter(Provider.id == provider_id).first()
        if not provider or not provider.naming_pattern:
            return {"error": "Provider or naming pattern not found"}

        # Transform the Voyarr naming pattern (e.g., {title}_{performers}) into a Regex pattern
        pattern = provider.naming_pattern
        pattern = pattern.replace("{title}", "(?P<title>.*?)")
        pattern = pattern.replace("{performers}", "(?P<performers>.*?)")
        pattern = pattern.replace("{resolution}", "(?P<resolution>.*?)")

        regex = re.compile(pattern)
        processed = 0

        for root, _, files in os.walk(directory):
            for file in files:
                if not file.endswith((".mp4", ".mkv", ".avi", ".ts", ".wmv")):
                    continue

                file_path = os.path.join(root, file)

                # Skip file if it's already cataloged
                existing = (
                    db.query(LibraryEntry)
                    .filter(LibraryEntry.file_path == file_path)
                    .first()
                )
                if existing:
                    continue

                # Reverse-engineer metadata using the regex match
                match = regex.search(file)
                title = file
                performers = []
                resolution = None

                if match:
                    data = match.groupdict()
                    title = data.get("title", file).replace(provider.separator, " ")
                    if "performers" in data and data["performers"]:
                        performers = [
                            p.strip()
                            for p in data["performers"].split(provider.separator)
                        ]
                    resolution = data.get("resolution")

                    # Embed metadata into the physical file using Mutagen
                    MediaTagger.tag_file(
                        file_path, {"title": title, "performers": performers}
                    )

                # Generate Hashes for Duplicate Detection / Stash Matching
                ohash = HashService.generate_ohash(file_path)
                phash = HashService.generate_phash(file_path)

                entry = LibraryEntry(
                    provider_id=provider.id,
                    title=title,
                    performers=performers,
                    file_path=file_path,
                    file_size=os.path.getsize(file_path),
                    resolution=resolution,
                    ohash=ohash,
                    phash=phash,
                )
                db.add(entry)
                processed += 1

        db.commit()
        return {"status": "success", "processed_files": processed}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()
