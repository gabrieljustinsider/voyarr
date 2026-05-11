import os
import hashlib
import ffmpeg
from PIL import Image
import imagehash
import tempfile

class HashService:
    @staticmethod
    def generate_ohash(file_path: str) -> str:
        """
        Generates an ohash (OpenSubtitles hash) for a file.
        This is a size + 64bit checksum of the first and last 64kb.
        """
        try:
            filesize = os.path.getsize(file_path)
            hash_size = 65536
            with open(file_path, 'rb') as f:
                f.seek(0)
                file_hash = filesize
                # Read first 64k
                for _ in range(hash_size // 8):
                    buffer = f.read(8)
                    if len(buffer) < 8:
                        break
                    file_hash += int.from_bytes(buffer, 'little')
                
                # Read last 64k
                f.seek(max(0, filesize - hash_size))
                for _ in range(hash_size // 8):
                    buffer = f.read(8)
                    if len(buffer) < 8:
                        break
                    file_hash += int.from_bytes(buffer, 'little')
                    
            file_hash &= 0xFFFFFFFFFFFFFFFF
            return "%016x" % file_hash
        except Exception as e:
            print(f"Error generating ohash for {file_path}: {e}")
            return ""

    @staticmethod
    def generate_phash(file_path: str) -> str:
        """
        Generates a perceptual hash (phash) for a video file by extracting
        a frame from the middle of the video and computing the DCT hash.
        """
        temp_frame_path = None
        try:
            # Get video duration to find the midpoint
            probe = ffmpeg.probe(file_path)
            format_info = probe.get('format', {})
            duration = float(format_info.get('duration', 0.0))
            midpoint = duration / 2.0 if duration > 0 else 0.0

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_frame:
                temp_frame_path = temp_frame.name

            # Extract a single frame at the midpoint
            (
                ffmpeg
                .input(file_path, ss=midpoint)
                .filter('scale', 320, -1)
                .output(temp_frame_path, vframes=1, loglevel="quiet")
                .overwrite_output()
                .run()
            )

            # Compute the perceptual hash using ImageHash (DCT)
            img = Image.open(temp_frame_path)
            phash_obj = imagehash.phash(img)
            img.close()

            return str(phash_obj)
        except Exception as e:
            print(f"Error generating phash for {file_path}: {e}")
            return ""
        finally:
            if temp_frame_path and os.path.exists(temp_frame_path):
                os.remove(temp_frame_path)