import os
import re
from typing import Dict, Any
from sqlalchemy.orm import Session
from models import LibraryEntry
from services.hash_service import HashService

class ReverseRegexMatcher:
    def __init__(self, db: Session):
        self.db = db

    def scan_directory(self, directory: str, provider_id: int, pattern: str) -> Dict[str, Any]:
        if not os.path.exists(directory):
            return {"error": f"Directory not found: {directory}"}

        # Convert pattern like {title}_{performers}_{resolution} to regex
        # Escape the pattern first
        regex_pattern = re.escape(pattern)
        
        # Replace placeholders with named capture groups
        placeholders = ["title", "performers", "tags", "resolution", "date", "site_id", "duration", "provider"]
        for ph in placeholders:
            regex_pattern = regex_pattern.replace(f"\\{{{ph}\\}}", f"(?P<{ph}>.+?)")

        # Add extension matching
        regex_pattern = f"^{regex_pattern}\\.(mp4|mkv|avi|mov|wmv)$"
        compiled_regex = re.compile(regex_pattern, re.IGNORECASE)

        results = {"scanned": 0, "matched": 0, "added": 0, "errors": []}

        for root, _, files in os.walk(directory):
            for file in files:
                results["scanned"] += 1
                match = compiled_regex.match(file)
                if match:
                    results["matched"] += 1
                    try:
                        extracted = match.groupdict()
                        file_path = os.path.join(root, file)
                        
                        # Check if already in DB to avoid duplicates
                        existing = self.db.query(LibraryEntry).filter(LibraryEntry.file_path == file_path).first()
                        if not existing:
                            performers = [p.strip() for p in extracted.get("performers", "").split(",")] if extracted.get("performers") else []
                            tags = [t.strip() for t in extracted.get("tags", "").split(",")] if extracted.get("tags") else []
                            
                            new_entry = LibraryEntry(
                                provider_id=provider_id,
                                title=extracted.get("title", file),
                                performers=performers,
                                tags=tags,
                                file_path=file_path,
                                resolution=extracted.get("resolution", "Unknown"),
                                file_size=os.path.getsize(file_path),
                                ohash=HashService.generate_ohash(file_path),
                                metadata=extracted
                            )
                            self.db.add(new_entry)
                            self.db.commit()
                            results["added"] += 1
                    except Exception as e:
                        self.db.rollback()
                        results["errors"].append({"file": file, "error": str(e)})

        return results