import os
from typing import Dict, Any
try:
    from mutagen.mp4 import MP4
except ImportError:
    MP4 = None

class MediaTagger:
    @staticmethod
    def tag_file(file_path: str, metadata: Dict[str, Any]) -> bool:
        """
        Appends metadata tags to an MP4 file using mutagen.
        """
        if MP4 is None or not os.path.exists(file_path):
            return False
            
        try:
            video = MP4(file_path)
            if 'title' in metadata:
                video['\xa9nam'] = metadata['title']
            if 'performers' in metadata and isinstance(metadata['performers'], list):
                video['\xa9ART'] = ", ".join(metadata['performers'])
            if 'description' in metadata:
                video['desc'] = metadata['description']
            video.save()
            return True
        except Exception as e:
            print(f"Failed to tag media file {file_path}: {str(e)}")
            return False