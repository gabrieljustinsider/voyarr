import os
import re
from celery import shared_task
from models import LibraryEntry, Provider
from services.hash_service import HashService
from services.media_tagger import MediaTagger
from typing import Optional
from utils import get_media_roots
from db_utils import get_db_session


@shared_task
def scan_library_task(directory: Optional[str], provider_id: int):
    """
    Scans target directories, reverse-engineers metadata from filenames
    using the Provider's naming pattern, calculates hashes, and saves to DB.
    """
    with get_db_session() as db:
        try:
            provider = db.query(Provider).filter(Provider.id == provider_id).first()
            if not provider or not provider.naming_pattern:
                return {"error": "Provider or naming pattern not found"}

            # Transform the Voyarr naming pattern (e.g., {title}_{performers}) into a Regex pattern
            pattern = provider.naming_pattern
            pattern = pattern.replace("{title}", "(?P<title>.*?)")
            pattern = pattern.replace("{performers}", "(?P<performers>.*?)")
            pattern = pattern.replace("{resolution}", "(?P<resolution>.*?)")
            
            cached_provider_id = provider.id
            cached_separator = provider.separator

            regex = re.compile(pattern)
            processed = 0
            
            media_roots = get_media_roots()
            target_dirs = []
            if directory:
                real_dir = os.path.realpath(directory)
                is_valid = any(
                    os.path.commonpath([root, real_dir]) == root for root in media_roots
                )
                if is_valid:
                    target_dirs.append(real_dir)
            if not target_dirs:
                target_dirs = media_roots
            
            existing_paths = {
                row[0] for row in db.query(LibraryEntry.file_path).all()
            }

            for d in target_dirs:
                if not os.path.exists(d):
                    continue
                for root, _, files in os.walk(d):
                    for file in files:
                        if not file.endswith((".mp4", ".mkv", ".avi", ".ts", ".wmv")):
                            continue

                        file_path = os.path.join(root, file)

                        # Skip file if it's already cataloged
                        if file_path in existing_paths:
                            continue

                        try:
                            # Reverse-engineer metadata using the regex match
                            match = regex.search(file)
                            title = file
                            performers = []
                            resolution = None

                            if match:
                                data = match.groupdict()
                                title = data.get("title", file).replace(cached_separator, " ")
                                if "performers" in data and data["performers"]:
                                    performers = [
                                        p.strip()
                                        for p in data["performers"].split(cached_separator)
                                    ]
                                resolution = data.get("resolution")

                                # Embed metadata into the physical file using Mutagen
                                try:
                                    MediaTagger.tag_file(
                                        file_path, {"title": title, "performers": performers}
                                    )
                                except Exception as e:
                                    print(f"Warning: Failed to tag file {file_path}: {str(e)}")

                            # Generate Hashes for Duplicate Detection / Stash Matching
                            ohash = HashService.generate_ohash(file_path)
                            phash = HashService.generate_phash(file_path)

                            entry = LibraryEntry(
                                provider_id=cached_provider_id,
                                title=title,
                                performers=performers,
                                file_path=file_path,
                                file_size=os.path.getsize(file_path),
                                resolution=resolution,
                                ohash=ohash,
                                phash=phash,
                            )
                            db.add(entry)
                            db.commit()
                            processed += 1
                        except Exception as e:
                            db.rollback()
                            print(f"Error processing file {file_path}: {str(e)}")

            return {"status": "success", "processed_files": processed}
        except Exception as e:
            return {"error": str(e)}
