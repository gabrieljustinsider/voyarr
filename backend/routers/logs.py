import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.websockets import WebSocketState
from dependencies import verify_api_key
from utils import get_primary_root

router = APIRouter(
    prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)]
)

def _get_log_file(source: str):
    if source not in ["celery", "fastapi"]:
        source = "celery"
    primary_root = get_primary_root()
    return os.path.join(primary_root, "logs", f"{source}.log")

@router.websocket("/ws")
async def websocket_logs(websocket: WebSocket, source: str = Query("celery")):
    await websocket.accept()
    log_file = _get_log_file(source)

    if not os.path.exists(log_file):
        await websocket.send_text(
            f"Log file not found. Ensure the {source} process has booted and generated logs.\n"
        )
        await websocket.close(code=1000)
        return

    try:
        from collections import deque
        with open(log_file, "r") as f:
            # Send the last 200 lines first
            lines = list(deque(f, maxlen=200))
            for line in lines:
                await websocket.send_text(line)

            # Tail the file continuously
            while True:
                line = f.readline()
                if not line:
                    await asyncio.sleep(0.5)
                    continue
                await websocket.send_text(line)
    except WebSocketDisconnect:
        pass
    except Exception:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=1011)

@router.get("/")
def get_logs(lines: int = 200, source: str = Query("celery")):
    log_file = _get_log_file(source)
    if not os.path.exists(log_file):
        return {
            "logs": [
                f"Log file not found. Ensure the {source} process has booted and generated logs."
            ]
        }

    try:
        from collections import deque
        with open(log_file, "r") as f:
            return {"logs": list(deque(f, maxlen=lines))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/")
def clear_logs(source: str = Query("celery")):
    log_file = _get_log_file(source)
    if os.path.exists(log_file):
        with open(log_file, "w") as f:
            f.write("")
    return {"message": f"{source} logs cleared"}
