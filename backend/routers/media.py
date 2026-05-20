import os
import mimetypes
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from db_utils import get_db_session
from models import LibraryEntry

router = APIRouter(prefix="/api/media", tags=["Media Stream"])

def chunk_generator(file_path: str, start: int, end: int, chunk_size: int = 1024 * 1024):
    """Yields file chunks to support seeking and buffering for large videos."""
    with open(file_path, "rb") as f:
        f.seek(start)
        while (pos := f.tell()) <= end:
            read_size = min(chunk_size, end + 1 - pos)
            yield f.read(read_size)

@router.get("/stream/{id}")
def stream_video(id: int, request: Request):
    """Streams media files directly to web clients and VR headsets."""
    with get_db_session() as db:
        entry = db.query(LibraryEntry).filter(LibraryEntry.id == id).first()
        if not entry or not entry.file_path or not os.path.exists(entry.file_path):
            raise HTTPException(status_code=404, detail="Media not found or file missing")
            
    file_path = entry.file_path
    file_size = os.path.getsize(file_path)
    
    # Handle HTTP Range requests (crucial for VR video seeking)
    range_header = request.headers.get("Range", None)
    
    if range_header:
        start_str, end_str = range_header.replace("bytes=", "").split("-")
        start = int(start_str)
        end = int(end_str) if end_str else file_size - 1
        status_code = status.HTTP_206_PARTIAL_CONTENT
    else:
        start = 0
        end = file_size - 1
        status_code = status.HTTP_200_OK
        
    content_length = (end - start) + 1
    mime_type, _ = mimetypes.guess_type(file_path)
    
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": mime_type or "video/mp4",
    }
    
    return StreamingResponse(
        chunk_generator(file_path, start, end),
        headers=headers,
        status_code=status_code,
    )