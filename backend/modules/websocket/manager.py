"""WebSocket Connection Manager — real-time event delivery infrastructure.

Locked contract per Spec-06 §1.5:
- Singleton `connection_manager` importable as:
    from modules.websocket.manager import connection_manager
- Method signatures must match exactly.
- In-memory dict (single process/container) — no Redis needed at 15-20 users.

Used by:
- Sprint 6: notifications.service.create_notification()
- Sprint 7: groups/service.py (group transaction broadcasts)
- Sprint 8: budgets/scheduler.py (budget alert broadcasts)
"""

from fastapi import WebSocket
from typing import Dict, List


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id.

    Single-process design: an in-memory dict works because this is one
    container. If this were ever split into multiple replicas, you'd
    need Redis pub/sub instead — out of scope per TRD.md §7.2 scale note.
    """

    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        """Accept the WebSocket and register it in the active dict."""
        await ws.accept()
        self.active[user_id] = ws

    def disconnect(self, user_id: str) -> None:
        """Remove a user's connection from the active dict. Idempotent."""
        self.active.pop(user_id, None)

    async def broadcast(self, user_ids: List[str], event: dict) -> None:
        """Send an event to each connected user in the list.

        Silently skips users who are not currently connected —
        no error, no log, just skip.
        """
        for uid in user_ids:
            ws = self.active.get(uid)
            if ws:
                try:
                    await ws.send_json(event)
                except Exception:
                    # Client disconnected between active check and send —
                    # clean up the stale entry.
                    self.disconnect(uid)


# Singleton instance — shared across all modules that need real-time broadcast.
connection_manager = ConnectionManager()