"""Notifications module — Business logic service.

Locked contract per Spec-06 §1.6:
- create_notification() saves to MongoDB AND broadcasts via WebSocket
  in the SAME call — this is the ONLY public function other modules should call.
- Import path locked: from modules.notifications.service import create_notification
- Other modules must NEVER call connection_manager.broadcast() directly for
  notification-worthy events; only create_notification() does both jobs atomically.

TODO Sprint 8: build modules/notifications/router.py with:
  - GET / → list notifications (paginated)
  - PUT /{id}/read → mark as read
  - PUT /read-all → mark all as read
"""

from datetime import datetime, timezone
from typing import Optional

from modules.notifications.models import Notification


async def create_notification(
    user_id: str,
    type: str,
    title: str,
    body: str,
    metadata: dict | None = None,
) -> Notification:
    """
    Saves the notification to MongoDB AND broadcasts it via WebSocket
    in the same call, per TRD.md §9.1. This is the ONLY function other
    modules should call — they must never call connection_manager.broadcast()
    directly for notification-worthy events; only create_notification() does
    both jobs atomically.

    Args:
        user_id: Target user's ID
        type: One of "group_transaction" | "budget_alert" |
              "income_received" | "expense_added"
        title: Short notification title
        body: Notification body text
        metadata: Optional dict with contextual fields (group_id, transaction_id, etc.)

    Returns:
        The saved Notification document.
    """
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        is_read=False,
        metadata=metadata or {},
        created_at=datetime.now(timezone.utc),
    )
    await notification.insert()

    # Broadcast via WebSocket in the same call
    from modules.websocket.manager import connection_manager

    # Serialize using Pydantic v2 model_dump
    payload = notification.model_dump(mode="json", by_alias=True, exclude_unset=True)
    # Map _id → id for frontend consumption
    payload["id"] = str(notification.id)
    payload.pop("_id", None)

    await connection_manager.broadcast(
        user_ids=[user_id],
        event={"type": "NOTIFICATION", "payload": payload},
    )

    return notification