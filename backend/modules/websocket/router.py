"""WebSocket Router — JWT-authenticated real-time connection endpoint.

Locked contract per Spec-06 §1.3:
- WS /ws/{user_id}?token=<access_token>
- Validates JWT token, rejects mismatched user_id (close 4001) or invalid token (close 4000)
- On disconnect: cleans up stale connection (try/finally)
- Tolerates incoming text frames (ping/pong) without crashing

Per Spec-06 §1.4, all future broadcasts use this event envelope:
    { "type": "GROUP_TRANSACTION" | "BUDGET_ALERT" | "NOTIFICATION", "payload": { ... } }
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from core import security
from modules.websocket.manager import connection_manager


router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...),
):
    """WebSocket connection endpoint with JWT authentication.

    Close codes:
    - 4000: invalid/expired token
    - 4001: token is valid but sub does NOT match path user_id

    On successful connect, the connection stays open, receiving
    text frames (swallowed — tolerates ping/pong from frontend)
    until the client disconnects.

    Per Spec-06 §1.3: use try/finally for cleanup so stale
    connections are never leaked in the manager's dict.
    """
    # Validate JWT token
    try:
        payload = security.decode_token(token, expected_type="access")
    except Exception:
        await websocket.close(code=4000, reason="invalid token")
        return

    # Verify token sub matches path user_id
    token_sub = payload.get("sub")
    if token_sub != user_id:
        await websocket.close(code=4001, reason="user_id mismatch")
        return

    # Accept and register connection
    await connection_manager.connect(user_id, websocket)

    try:
        # Keep connection alive — tolerate incoming text frames
        # (frontend sends "ping" heartbeat every 30s per Spec-06 §1.9)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Always clean up — don't leak stale connections.
        connection_manager.disconnect(user_id)