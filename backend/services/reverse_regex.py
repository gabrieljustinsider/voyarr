"""Reverse regex scanning service."""
import os
import re
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models import LibraryEntry, MediaEntry, FileNamingHistory
from services.hash_service import HashService
from utils import validate_path, sanitize_tainted_path


class ReverseRegexMatcher:
    """Service to reverse-engineer media file names into database entries."""

    def __init__(self, db: Session):
        self.db = db

    def pattern_to_regex(self, pattern: str) -> re.Pattern:
        """
        Converts a Voyarr naming pattern like '{title}_{performers}_{resolution}'
        into a functional regex like '^(?P<title>.*?)_(?P<performers>.*?)_(?P<resolution>.*?)$'
        """
        escaped_pattern = re.escape(pattern)
        # Revert escaped curly braces so we can process them
        escaped_pattern = escaped_pattern.replace(r"\{", "{").replace(r"\}", "}")

        # Replace template variables with named capture groups
        regex_str = re.sub(r"\{(\w+)\}", r"(?P<\1>.*?)", escaped_pattern)
        return re.compile(f"^{regex_str}$", re.IGNORECASE)

    def scan_directory(self, directory: str, provider_id: Optional[int] = None, pattern: Optional[str] = None) -> dict[str, Any]:
        """
        Scans a directory matching files against a regex pattern.
        """
        # SECURITY: Prevent path traversal and arbitrary file reads outside of media roots
        try:
            real_dir = validate_path(directory)
        except Exception as e:  # pylint: disable=broad-exception-caught
            return {"error": f"Access denied or invalid directory path: {str(e)}"}

        # Inline sanitization for CodeQL path injection tracking
        abs_real_dir = sanitize_tainted_path(real_dir)

        if not os.path.exists(abs_real_dir):
            return {"error": f"Directory not found: {directory}"}

        # Find or create General provider
        from models import Provider
        general_provider = self.db.query(Provider).filter(Provider.name == "General").first()
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
                self.db.add(general_provider)
                self.db.commit()
                self.db.refresh(general_provider)
            except Exception:
                self.db.rollback()

        # Pre-compile regexes for all providers if doing auto-detect
        providers_with_regex = []
        if provider_id is None:
            all_providers = self.db.query(Provider).all()
            for p in all_providers:
                if p.name == "General":
                    continue
                pat = p.naming_pattern or "{title}_{performers}"
                providers_with_regex.append((p, self.pattern_to_regex(pat)))
        else:
            # Single provider mode
            target_provider = self.db.query(Provider).filter(Provider.id == provider_id).first()
            if not target_provider:
                target_provider = general_provider
            pat = pattern or target_provider.naming_pattern or "{title}"
            providers_with_regex.append((target_provider, self.pattern_to_regex(pat)))

        # Fetch global excluded subfolders from DB
        excluded_set = set()
        try:
            from models import Settings
            import json
            setting = self.db.query(Settings).filter(Settings.key == "ignored_subfolders").first()
            if setting and setting.value:
                excluded_set = set(json.loads(str(setting.value)))
        except Exception:
            pass

        added = 0
        matched = 0
        errors = []

        for root, dirs, files in os.walk(abs_real_dir):  # lgtm [py/path-injection]
            # Prune excluded directories in-place from os.walk
            pruned_dirs = []
            for d in list(dirs):
                d_path = os.path.normpath(os.path.join(root, d))
                has_nomedia = os.path.exists(os.path.join(d_path, ".nomedia")) or os.path.exists(os.path.join(d_path, ".voyarrignore"))
                if d_path in excluded_set or has_nomedia:
                    dirs.remove(d)

            # Skip scanning current root if marked as excluded
            norm_root = os.path.normpath(root)
            if norm_root in excluded_set or os.path.exists(os.path.join(norm_root, ".nomedia")) or os.path.exists(os.path.join(norm_root, ".voyarrignore")):
                continue

            for filename in files:
                if not filename.lower().endswith((".mp4", ".mkv", ".avi", ".mov", ".webm")):
                    continue

                file_path = os.path.join(root, filename)
                # Inline check for CodeQL path injection tracking
                abs_file_path = sanitize_tainted_path(file_path)
                file_path = abs_file_path
                filename_no_ext = os.path.splitext(filename)[0]

                # Determine provider and match
                matched_provider = None
                matched_data = {}
                adheres = False

                for p, regex in providers_with_regex:
                    match = regex.match(filename_no_ext)
                    if match:
                        matched_provider = p
                        matched_data = match.groupdict()
                        adheres = True
                        matched += 1
                        break

                if not adheres:
                    if provider_id is not None:
                        matched_provider = providers_with_regex[0][0]
                        matched_data = {}
                    else:
                        matched_provider = general_provider
                        gen_regex = self.pattern_to_regex(general_provider.naming_pattern)
                        gen_match = gen_regex.match(filename_no_ext)
                        if gen_match:
                            matched_data = gen_match.groupdict()
                        else:
                            matched_data = {"title": filename_no_ext}
                        adheres = True
                        matched += 1

                try:
                    with self.db.begin_nested():
                        existing = (
                            self.db.query(LibraryEntry.id)
                            .filter(LibraryEntry.file_path == file_path)
                            .first()
                        )
                        if existing:
                            continue

                        title = matched_data.get("title", filename_no_ext).replace("_", " ")
                        performers_str = matched_data.get("performers", "")
                        performers = (
                            [p.strip() for p in performers_str.split(",")]
                            if performers_str
                            else []
                        )
                        tags_str = matched_data.get("tags", "")
                        tags = [t.strip() for t in tags_str.split(",")] if tags_str else []
                        resolution = matched_data.get("resolution", "1080p")

                        media_id = None
                        has_metadata = False
                        if adheres and matched_provider.name != "General":
                            media = MediaEntry(
                                provider_id=matched_provider.id,
                                title=title,
                                performers=performers,
                                tags=tags,
                                media_metadata=matched_data,
                            )
                            self.db.add(media)
                            self.db.flush()
                            media_id = media.id
                            has_metadata = True

                        library_entry = LibraryEntry(
                            media_entry_id=media_id,
                            provider_id=matched_provider.id,
                            title=title,
                            performers=performers,
                            tags=tags,
                            file_path=file_path,
                            resolution=resolution,
                            file_size=os.path.getsize(file_path),  # lgtm [py/path-injection]
                            entry_metadata=matched_data,
                            adheres_to_naming_scheme=adheres,
                            has_metadata_match=has_metadata,
                            has_chapters=False,
                            has_facial_clusters=False,
                        )

                        library_entry.ohash = HashService.generate_ohash(file_path)
                        library_entry.phash = HashService.generate_phash(file_path)

                        self.db.add(library_entry)
                        self.db.flush()

                        # Log initial naming history
                        history = FileNamingHistory(
                            library_entry_id=library_entry.id,
                            old_path=None,
                            new_path=file_path,
                            old_filename=None,
                            new_filename=os.path.basename(file_path),
                            reason="initial"
                        )
                        self.db.add(history)
                        added += 1
                except Exception as e:  # pylint: disable=broad-exception-caught
                    errors.append(f"Error processing {filename}: {str(e)}")
        try:
            self.db.commit()
        except SQLAlchemyError as e:
            self.db.rollback()
            errors.append(
                f"Database commit failed, all changes rolled back. Error: {str(e)}"
            )
            added = 0  # Reset count as nothing was added
        return {"added": added, "matched": matched, "errors": errors}
