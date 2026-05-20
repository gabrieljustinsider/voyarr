from fastapi import APIRouter, Request
from db_utils import get_db_session
from models import LibraryEntry

router = APIRouter(prefix="/api/deovr", tags=["DeoVR"])

@router.get("")
def get_deovr_library(request: Request):
    """
    Generates a DeoVR-compatible JSON payload for XR headsets.
    To use this, enter http://<your-ip>:8000/api/deovr in the DeoVR browser.
    """
    with get_db_session() as db:
        # Fetch all library entries that are VR-compatible (i.e., not flat 2D)
        # In the future, you can add pagination or category filtering here
        vr_entries = db.query(LibraryEntry).filter(
            LibraryEntry.file_path.isnot(None),
            LibraryEntry.screen_type.in_(["dome", "sphere"])
        ).all()
        
        scenes = []
        # Strip trailing slash from base_url just in case
        base_url = str(request.base_url).rstrip("/")
        
        for entry in vr_entries:
            # Parse resolution to an integer for DeoVR (e.g., '2160p' -> 2160)
            res_val = 1080
            if entry.resolution:
                clean_res = ''.join(filter(str.isdigit, str(entry.resolution)))
                if clean_res:
                    res_val = int(clean_res)
            
            # Construct the DeoVR scene object
            scenes.append({
                "title": entry.title or f"VR Video {entry.id}",
                "screenType": entry.screen_type, # 'dome' (180) or 'sphere' (360)
                "stereoMode": entry.stereo_mode, # 'sbs' or 'tb'
                "encodings": [
                    {
                        "name": "mp4", # Default encoding name
                        "videoSources": [
                            {
                                "resolution": res_val,
                                # Adjust the URL below to match your actual media streaming endpoint
                                "url": f"{base_url}/api/media/stream/{entry.id}"
                            }
                        ]
                    }
                ]
            })
            
        return {"scenes": scenes}