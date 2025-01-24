import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from dependencies import verify_api_key
from utils import get_primary_root

router = APIRouter(
    prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)]
)


@router.websocket("/ws")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()

    primary_root = get_primary_root()
    log_file = os.path.join(
        primary_root, "logs", "celery.log"
    )
    if not os.path.exists(log_file):
        await websocket.send_text(
            "Log file not found. Ensure the Celery worker has booted and generated logs.\n"
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
def get_logs(lines: int = 200):
    primary_root = get_primary_root()
    log_file = os.path.join(
        primary_root, "logs", "celery.log"
    )
    if not os.path.exists(log_file):
        return {
            "logs": [
                "Log file not found. Ensure the Celery worker has booted and generated logs."
            ]
        }

    try:
        from collections import deque
        with open(log_file, "r") as f:
            return {"logs": list(deque(f, maxlen=lines))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/")
def clear_logs():
    primary_root = get_primary_root()
    log_file = os.path.join(
        primary_root, "logs", "celery.log"
    )
    if os.path.exists(log_file):
        with open(log_file, "w") as f:
            f.write("")
    return {"message": "Logs cleared"}
