import os
import struct
import subprocess
import tempfile

try:
    from PIL import Image
    import imagehash
except ImportError:
    Image = None
    imagehash = None

class HashService:
    @staticmethod
    def generate_ohash(file_path: str) -> str:
        """
        Generates the standard 64-bit oshash (OpenSubtitles hash) from the file structure.
        """
        try:
            longlongformat = '<q'  # little-endian long long
            bytesize = struct.calcsize(longlongformat)
            filesize = os.path.getsize(file_path)
            hash_val = filesize
            
            if filesize < 65536 * 2:
                return "0000000000000000"
                
            with open(file_path, "rb") as f:
                for _ in range(65536 // bytesize):
                    buffer = f.read(bytesize)
                    (l_value,) = struct.unpack(longlongformat, buffer)
                    hash_val += l_value
                    hash_val = hash_val & 0xFFFFFFFFFFFFFFFF
                    
                f.seek(max(0, filesize - 65536), 0)
                for _ in range(65536 // bytesize):
                    buffer = f.read(bytesize)
                    (l_value,) = struct.unpack(longlongformat, buffer)
                    hash_val += l_value
                    hash_val = hash_val & 0xFFFFFFFFFFFFFFFF
                    
            return "%016x" % hash_val
        except Exception:
            return "0000000000000000"

    @staticmethod
    def generate_phash(file_path: str) -> str:
        """
        Extracts a frame at 20% duration and calculates a perceptual DCT image hash.
        """
        if not Image or not imagehash:
            return ""
            
        try:
            # Get video duration
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
            )
            duration = float(result.stdout.strip())
            target_time = duration * 0.2

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                temp_filename = tmp.name

            # Extract single frame
            subprocess.run(["ffmpeg", "-y", "-ss", str(target_time), "-i", file_path, "-vframes", "1", "-q:v", "2", temp_filename], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            if os.path.exists(temp_filename):
                img = Image.open(temp_filename)
                hash_val = str(imagehash.phash(img))
                img.close()
                os.remove(temp_filename)
                return hash_val
        except Exception as e:
            print(f"Error generating phash: {e}")
        return ""