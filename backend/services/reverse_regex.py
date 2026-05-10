import os
import re
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from models import LibraryEntry, Provider, DownloadPreference
from services.hash_service import HashService

class ReverseRegexMatcher:
    def __init__(self, db: Session):
        self.db = db

    def pattern_to_regex(self, pattern: str) -> re.Pattern:
        """
        Converts a naming pattern like '{title}_{performers}_{resolution}' 
        into a compiled regex object.
        """
        # Escape the pattern first to handle any literal dots or brackets
        # But we need to unescape the curly braces to parse them
        escaped_pattern = re.escape(pattern)
        
        # Replace escaped \{var\} with regex named groups
        # e.g., \{title\} -> (?P<title>.*?)
        regex_str = escaped_pattern.replace(r'\{title\}', r'(?P<title>.*?)')
        regex_str = regex_str.replace(r'\{performers\}', r'(?P<performers>.*?)')
        regex_str = regex_str.replace(r'\{resolution\}', r'(?P<resolution>.*?)')
        regex_str = regex_str.replace(r'\{date\}', r'(?P<date>.*?)')
        regex_str = regex_str.replace(r'\{studio\}', r'(?P<studio>.*?)')
        
        # Allow any common video extension
        regex_str = f"^{regex_str}\\.(mp4|mkv|avi|mov|webm)$"
        return re.compile(regex_str, re.IGNORECASE)

    def scan_directory(self, directory: str, provider_id: int, pattern: str) -> Dict[str, Any]:
        """
        Scans a directory for files matching the given provider's pattern
        and creates LibraryEntry records.
        """
        if not os.path.exists(directory):
            return {"error": "Directory does not exist", "added": 0}

        regex = self.pattern_to_regex(pattern)
        added_count = 0
        skipped_count = 0

        for root, _, files in os.walk(directory):
            for filename in files:
                match = regex.match(filename)
                if not match:
                    continue

                filepath = os.path.join(root, filename)
                
                # Check if already in DB
                existing = self.db.query(LibraryEntry).filter(LibraryEntry.file_path == filepath).first()
                if existing:
                    skipped_count += 1
                    continue

                metadata = match.groupdict()
                
                # Parse performers (assuming comma or ' and ' separated)
                performers_raw = metadata.get('performers', '')
                performers_list = [p.strip() for p in re.split(r',| and ', performers_raw)] if performers_raw else []

                # Calculate hash for duplicate detection
                try:
                    ohash = HashService.generate_ohash(filepath)
                except Exception:
                    ohash = None

                entry = LibraryEntry(
                    provider_id=provider_id,
                    title=metadata.get('title', filename),
                    performers=performers_list,
                    tags=[metadata.get('studio')] if metadata.get('studio') else [],
                    file_path=filepath,
                    file_size=os.path.getsize(filepath),
                    resolution=metadata.get('resolution', 'Unknown'),
                    ohash=ohash,
                    metadata=metadata
                )
                
                self.db.add(entry)
                added_count += 1
        
        self.db.commit()
        return {"added": added_count, "skipped": skipped_count}
