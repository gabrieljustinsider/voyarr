import os
import re
from celery import shared_task  # type: ignore
from models import LibraryEntry, Provider
from services.hash_service import HashService
from services.media_tagger import MediaTagger
from typing import Any, Optional
from utils import get_media_roots
from db_utils import get_db_session, get_or_create_studio_by_name


@shared_task
def scan_library_task(directory: Optional[str], provider_id: Optional[int] = None) -> dict[str, Any]:
    """
    Scans target directories, reverse-engineers metadata from filenames
    using the Provider's naming pattern, calculates hashes, and saves to DB.
    """
    with get_db_session() as db:
        try:
            general_provider = db.query(Provider).filter(Provider.name == "General").first()
            if not general_provider:
                general_provider = Provider(
                    name="General",
                    base_url="https://voyarr.local",
                    naming_pattern="{title}",
                    separator="_",
                    space_replacement="_",
                    logo_url="https://www.google.com/s2/favicons?domain=voyarr.local&sz=128",
                    automatic_limits={"daily_downloads": 0},
                    supported_methods=["cookies", "direct", "api"]
                )
                try:
                    db.add(general_provider)
                    db.commit()
                    db.refresh(general_provider)
                except Exception:
                    db.rollback()

            providers_with_regex = []
            if provider_id is None:
                all_providers = db.query(Provider).all()
                for p in all_providers:
                    if p.name == "General":
                        continue
                    pat = str(p.naming_pattern or "{title}_{performers}")
                    pat = pat.replace("{title}", "(?P<title>.*?)").replace("{performers}", "(?P<performers>.*?)").replace("{resolution}", "(?P<resolution>.*?)")
                    providers_with_regex.append((p, re.compile(pat, re.IGNORECASE)))
            else:
                provider = db.query(Provider).filter(Provider.id == provider_id).first()
                if not provider:
                    provider = general_provider
                pat = str(provider.naming_pattern or "{title}")
                pat = pat.replace("{title}", "(?P<title>.*?)").replace("{performers}", "(?P<performers>.*?)").replace("{resolution}", "(?P<resolution>.*?)")
                providers_with_regex.append((provider, re.compile(pat, re.IGNORECASE)))

            processed = 0

            media_roots = get_media_roots()
            target_dirs: list[str] = []
            if directory:
                real_dir = os.path.realpath(directory)
                is_valid = any(
                    os.path.commonpath([root, real_dir]) == root for root in media_roots
                )
                if is_valid:
                    target_dirs.append(real_dir)
            if not target_dirs:
                target_dirs = media_roots

            existing_paths = {row[0] for row in db.query(LibraryEntry.file_path).all()}

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
                            # Determine provider and match
                            matched_provider = None
                            matched_data = {}
                            adheres = False

                            for p, reg in providers_with_regex:
                                match = reg.search(file)
                                if match:
                                    matched_provider = p
                                    matched_data = match.groupdict()
                                    adheres = True
                                    break

                            if not adheres:
                                if provider_id is not None:
                                    matched_provider = providers_with_regex[0][0]
                                    matched_data = {}
                                else:
                                    matched_provider = general_provider
                                    matched_data = {"title": os.path.splitext(file)[0]}
                                    adheres = True

                            cached_separator = str(matched_provider.separator) if matched_provider.separator else "_"
                            title = matched_data.get("title", os.path.splitext(file)[0]).replace(cached_separator, " ")
                            performers = []
                            if "performers" in matched_data and matched_data["performers"]:
                                performers = [p.strip() for p in matched_data["performers"].split(cached_separator)]
                            resolution = matched_data.get("resolution")

                            # Embed metadata into the physical file using Mutagen
                            if adheres and matched_provider.name != "General":
                                try:
                                    MediaTagger.tag_file(
                                        file_path,
                                        {"title": title, "performers": performers},
                                    )
                                except Exception as e:
                                    print(
                                        f"Warning: Failed to tag file {file_path}: {str(e)}"
                                    )

                            # Generate Hashes for Duplicate Detection / Stash Matching
                            ohash = HashService.generate_ohash(file_path)
                            phash = HashService.generate_phash(file_path)

                            cached_studio_id = get_or_create_studio_by_name(db, str(matched_provider.name))

                            entry = LibraryEntry(
                                provider_id=matched_provider.id,
                                studio_id=cached_studio_id,
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

                            try:
                                from services.notification_service import (
                                    NotificationService,
                                )

                                NotificationService.check_and_notify_favorites(  # type: ignore
                                    db, entry
                                )
                            except Exception as fav_err:
                                print(
                                    f"Error checking favorites during scan: {fav_err}"
                                )

                            processed += 1
                        except Exception as e:
                            db.rollback()
                            print(f"Error processing file {file_path}: {str(e)}")

            try:
                from services.notification_service import NotificationService

                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Library Scan Completed",
                    f"Library scan completed. Found and processed {processed} new file(s).",
                )
            except Exception as notif_err:
                print(f"Error sending scan completion notification: {notif_err}")

            return {"status": "success", "processed_files": processed}
        except Exception as e:
            return {"error": str(e)}


@shared_task
def process_missing_hashes_task() -> dict[str, Any]:
    """
    Scans the database for LibraryEntries missing either an ohash or phash
    and attempts to regenerate them based on the local file.
    """
    from sqlalchemy.orm import defer

    with get_db_session() as db:
        entries = (
            db.query(LibraryEntry)
            .options(
                defer(LibraryEntry.entry_metadata),  # type: ignore
                defer(LibraryEntry.performers),  # type: ignore
                defer(LibraryEntry.tags),  # type: ignore
            )
            .filter((LibraryEntry.phash.is_(None)) | (LibraryEntry.phash == ""))
            .yield_per(50)
        )

        processed = 0
        for entry in entries:
            try:
                if os.path.exists(str(entry.file_path)):  # type: ignore
                    if not entry.ohash or entry.ohash == "0000000000000000":  # type: ignore
                        entry.ohash = HashService.generate_ohash(str(entry.file_path))  # type: ignore
                    entry.phash = HashService.generate_phash(str(entry.file_path))  # type: ignore
                    db.commit()
                    processed += 1
            except Exception as e:
                db.rollback()
                print(f"Error rescanning hashes for entry {entry.id}: {str(e)}")
        return {"processed": processed}
