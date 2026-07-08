"""Notifications module — Business logic service.

Locked contract per Spec-08 §1.6 and Spec-06 §1.6:
- create_notification() saves to MongoDB AND broadcasts via WebSocket
  in the same call — this is the ONLY function other modules should call.
- list_notifications() returns paginated results with total and unread_count
- mark_as_read() updates single notification
- mark_all_as_read() updates all for user and returns count

Pagination defaults per Sprint 8 requirements: 10 items per page, max 100.
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from fastapi import HTTPException

from modules.notifications.models import Notification
from modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
)


async def create_notification(
    user_id: str,
    type: str,
    title: str,
    body: str,
    metadata: dict | None = None,
    category: str | None = None,
) -> Notification | None:
    """
    Saves the notification to MongoDB AND broadcasts it via WebSocket
    in the same call, per TRD.md §9.1. This is the ONLY function other
    modules should call — they must never call connection_manager.broadcast()
    directly for notification-worthy events; only create_notification() does
    both jobs atomically.

    Args:
        user_id:  Target user's ID
        type:     One of "group_transaction" | "budget_alert" |
                  "income_received" | "expense_added" | "friend_request"
        title:    Short notification title
        body:     Notification body text
        metadata: Optional dict with contextual fields
        category: One of "friends" | "groups" | "budget" | None.
                  When provided, the target user's notification_preferences
                  for that category is checked; if OFF the notification is
                  silently skipped and None is returned.
                  None means always-deliver (system-level or uncategorised).

    Returns:
        The saved Notification document, or None if skipped.
    """
    # ── Preference gate ────────────────────────────────────────────────────
    if category is not None:
        from modules.auth.models import User
        from beanie import PydanticObjectId as _OID
        try:
            target_user = await User.get(_OID(user_id))
        except Exception:
            target_user = None
        if target_user:
            prefs = target_user.notification_preferences
            enabled = getattr(prefs, category, True)  # unknown categories default to enabled
            if not enabled:
                return None  # user has opted out — skip silently
    # ──────────────────────────────────────────────────────────────────────

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


async def list_notifications(
    user_id: str,
    is_read: Optional[bool] = None,
    limit: int = 10,
    offset: int = 0,
) -> NotificationListResponse:
    """List notifications with pagination and filtering."""
    # Clamp limit between 1 and 100 per requirements
    limit = max(1, min(limit, 100))

    # Build query filter
    query_filter = {"user_id": user_id}
    if is_read is not None:
        query_filter["is_read"] = is_read

    # Execute parallel queries for items, total, and unread count
    items_task = Notification.find(query_filter).sort(-Notification.created_at).skip(offset).limit(limit).to_list()
    total_task = Notification.find(query_filter).count()
    unread_task = Notification.find({"user_id": user_id, "is_read": False}).count()

    items, total, unread_count = await items_task, await total_task, await unread_task

    # Convert to response format
    notification_responses = []
    for notification in items:
        response = NotificationResponse(
            id=str(notification.id),
            type=notification.type,
            title=notification.title,
            body=notification.body,
            is_read=notification.is_read,
            metadata=notification.metadata,
            created_at=notification.created_at.isoformat(),
        )
        notification_responses.append(response)

    return NotificationListResponse(
        items=notification_responses,
        total=total,
        unread_count=unread_count,
    )


async def mark_as_read(user_id: str, notification_id: str) -> NotificationResponse:
    """Mark a single notification as read."""
    try:
        oid = PydanticObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "NOT_FOUND",
                "message": "Notification not found.",
                "details": {"notification_id": notification_id},
            },
        )

    notification = await Notification.find_one({"_id": oid, "user_id": user_id})
    if not notification:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "NOT_FOUND",
                "message": "Notification not found.",
                "details": {"notification_id": notification_id},
            },
        )

    notification.is_read = True
    await notification.save()

    return NotificationResponse(
        id=str(notification.id),
        type=notification.type,
        title=notification.title,
        body=notification.body,
        is_read=notification.is_read,
        metadata=notification.metadata,
        created_at=notification.created_at.isoformat(),
    )


async def mark_all_as_read(user_id: str) -> int:
    """Mark all user's notifications as read. Returns number updated."""
    result = await Notification.get_motor_collection().update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return result.modified_count
