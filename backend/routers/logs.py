import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from dependencies import verify_api_key

router = APIRouter(
    prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)]
)


@router.websocket("/ws")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()

    log_file = os.path.join(
        os.getenv("MEDIA_ROOT", "/media/storage"), "logs", "celery.log"
    )
    if not os.path.exists(log_file):
        await websocket.send_text(
            "Log file not found. Ensure the Celery worker has booted and generated logs.\n"
        )
        await websocket.close(code=1000)
        return

    try:
        with open(log_file, "r") as f:
            # Send the last 200 lines first
            lines = f.readlines()[-200:]
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
    log_file = os.path.join(
        os.getenv("MEDIA_ROOT", "/media/storage"), "logs", "celery.log"
    )
    if not os.path.exists(log_file):
        return {
            "logs": [
                "Log file not found. Ensure the Celery worker has booted and generated logs."
            ]
        }

    try:
        with open(log_file, "r") as f:
            all_lines = f.readlines()
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/")
def clear_logs():
    log_file = os.path.join(
        os.getenv("MEDIA_ROOT", "/media/storage"), "logs", "celery.log"
    )
    if os.path.exists(log_file):
        with open(log_file, "w") as f:
            f.write("")
    return {"message": "Logs cleared"}
