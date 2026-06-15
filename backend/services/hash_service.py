import os
import cv2
import numpy as np
import subprocess  # nosec B404
from utils import sanitize_tainted_path


class HashService:
    @staticmethod
    def generate_ohash(file_path: str) -> str:
        """
        Generates OpenSubtitles Hash (oshash) for the file.
        """
        try:
            # Inline validation for CodeQL path traversal tracking
            file_path = sanitize_tainted_path(file_path)
            if file_path == "/":
                raise ValueError("Invalid path")

            filesize = os.path.getsize(file_path)
            hash_val = filesize
            if filesize < 65536 * 2:
                return "0"
            with open(file_path, "rb") as f:
                buf = f.read(65536)
                f.seek(filesize - 65536, 0)
                buf += f.read(65536)
            for i in range(16384):
                chunk = buf[i * 8 : i * 8 + 8]
                val = int.from_bytes(chunk, byteorder="little")
                hash_val = (hash_val + val) & 0xFFFFFFFFFFFFFFFF
            return f"{hash_val:016x}"
        except Exception:
            return "0"

    @staticmethod
    def generate_phash(file_path: str) -> str:
        """
        Generates perceptual hash (pHash) from a video using DCT on a middle frame.
        """
        out_image = None
        try:
            # Inline validation for CodeQL path traversal and command injection tracking
            file_path = sanitize_tainted_path(file_path)
            if file_path == "/":
                raise ValueError("Invalid path")

            import tempfile
            
            # Calculate middle of the video using ffprobe
            duration_cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                file_path,
            ]
            duration = float(
                subprocess.check_output(duration_cmd).decode("utf-8").strip()
            )  # nosec B603 B607
            mid_time = duration / 2.0

            # Extract frame using ffmpeg
            subprocess.run(  # nosec B603 B607
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    str(mid_time),
                    "-i",
                    file_path,
                    "-vframes",
                    "1",
                    "-q:v",
                    "2",
                    out_image,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            if not os.path.exists(out_image):
                return ""

            # Compute DCT-based perceptual hash
            img = np.float32(
                cv2.resize(cv2.imread(out_image, cv2.IMREAD_GRAYSCALE), (32, 32))
            )
            dct = cv2.dct(img)
            dct_low = dct[0:8, 0:8]
            avg = np.mean(dct_low[1:, 1:])  # Exclude DC component

            phash = sum(
                (1 << (i * 8 + j))
                for i in range(8)
                for j in range(8)
                if dct_low[i, j] > avg
            )

            return f"{phash:016x}"
        except Exception as e:
            print(f"pHash error: {e}")
            return ""
        finally:
            if out_image and os.path.exists(out_image):
                try:
                    os.remove(out_image)
                except Exception:
                    pass
