import os
import asyncio
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi.websockets import WebSocketState
from dependencies import verify_api_key
from utils import get_primary_root

router = APIRouter(
    prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)]
)


def _get_log_file(source: str):
    # Map to strict hardcoded strings to prevent CodeQL path injection alerts
    log_name = "fastapi.log" if source == "fastapi" else "celery.log"
    primary_root = get_primary_root()
    return os.path.join(primary_root, "logs", log_name)


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
        import aiofiles

        with open(log_file, "r") as f:
            # Send the last 200 lines first
            lines = list(deque(f, maxlen=200))
            current_position = f.tell()

        for line in lines:
            await websocket.send_text(line)

        # Tail the file continuously using aiofiles to prevent event loop blocking
        async with aiofiles.open(log_file, "r") as af:
            await af.seek(current_position)
            while True:
                line = await af.readline()
                if not line:
                    try:
                        # Wait on receive() to instantly detect if the client disconnects while idling
                        await asyncio.wait_for(websocket.receive(), timeout=0.5)
                    except asyncio.TimeoutError:
                        continue # Expected timeout, no new messages
                    except WebSocketDisconnect:
                        break # Client disconnected normally
                else:
                    await websocket.send_text(line)
    except WebSocketDisconnect:
        pass
    except Exception:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=1011)


@router.get("")
async def get_logs(lines: int = 200, source: str = Query("celery")):
    log_file = _get_log_file(source)
    if not os.path.exists(log_file):
        return {
            "logs": [
                f"Log file not found. Ensure the {source} process has booted and generated logs."
            ]
        }

    try:
        from collections import deque
        import aiofiles

        async with aiofiles.open(log_file, "r") as f:
            d = deque(maxlen=lines)
            async for line in f:
                d.append(line)
            return {"logs": list(d)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def clear_logs(source: str = Query("celery")):
    log_file = _get_log_file(source)
    if os.path.exists(log_file):
        import aiofiles
        async with aiofiles.open(log_file, "w") as f:
            await f.write("")
    return {"message": f"{source} logs cleared"}
