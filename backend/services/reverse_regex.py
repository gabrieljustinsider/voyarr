import os
import re
from sqlalchemy.orm import Session
from models import LibraryEntry, MediaEntry
from services.hash_service import HashService

class ReverseRegexMatcher:
    def __init__(self, db: Session):
        self.db = db

    def pattern_to_regex(self, pattern: str) -> re.Pattern:
        """
        Converts a Voyarr naming pattern like '{title}_{performers}_{resolution}'
        into a functional regex like '^(?P<title>.*?)_(?P<performers>.*?)_(?P<resolution>.*?)$'
        """
        escaped_pattern = re.escape(pattern)
        # Revert escaped curly braces so we can process them
        escaped_pattern = escaped_pattern.replace(r'\{', '{').replace(r'\}', '}')
        
        # Replace template variables with named capture groups
        regex_str = re.sub(r'\{(\w+)\}', r'(?P<\1>.*?)', escaped_pattern)
        return re.compile(f"^{regex_str}$", re.IGNORECASE)

    def scan_directory(self, directory: str, provider_id: int, pattern: str) -> dict:
        if not os.path.exists(directory):
            return {"error": f"Directory not found: {directory}"}

        regex = self.pattern_to_regex(pattern)
        added = 0
        matched = 0
        errors = []

        for root, _, files in os.walk(directory):
            for file in files:
                if not file.lower().endswith(('.mp4', '.mkv', '.avi', '.mov', '.webm')):
                    continue

                file_path = os.path.join(root, file)
                filename_no_ext = os.path.splitext(file)[0]

                match = regex.match(filename_no_ext)
                if not match:
                    continue

                try:
                    matched += 1
                    data = match.groupdict()
                    
                    existing = self.db.query(LibraryEntry.id).filter(LibraryEntry.file_path == file_path).first()
                    if existing:
                        continue
                    
                    title = data.get('title', filename_no_ext).replace('_', ' ')
                    performers_str = data.get('performers', '')
                    performers = [p.strip() for p in performers_str.split(',')] if performers_str else []
                    tags_str = data.get('tags', '')
                    tags = [t.strip() for t in tags_str.split(',')] if tags_str else []
                    resolution = data.get('resolution', '1080p')
                    
                    media = MediaEntry(provider_id=provider_id, title=title, performers=performers, tags=tags, media_metadata=data)
                    self.db.add(media)
                    self.db.flush() # Get media.id
                    
                    library_entry = LibraryEntry(
                        media_entry_id=media.id, provider_id=provider_id, title=title,
                        performers=performers, tags=tags, file_path=file_path, resolution=resolution,
                        file_size=os.path.getsize(file_path), entry_metadata=data
                    )
                    library_entry.ohash = HashService.generate_ohash(file_path)
                    library_entry.phash = HashService.generate_phash(file_path)
                    
                    self.db.add(library_entry)
                    added += 1
                except Exception as e:
                    errors.append(f"Error processing {file}: {str(e)}")
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            errors.append(f"Database commit failed, all changes rolled back. Error: {str(e)}")
            added = 0 # Reset count as nothing was added
        return {"added": added, "matched": matched, "errors": errors}