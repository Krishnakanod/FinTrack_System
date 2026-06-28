"""Notifications module — Beanie Document model for in-app notifications.

Locked contract per Spec-06 §1.7 — minimum viable schema for this sprint.
Router/list/mark-read endpoints are explicitly NOT built this sprint (Sprint 8's job).

Used by:
- Sprint 7: groups/service.py (transaction notifications)
- Sprint 8: budgets/scheduler.py (budget alert notifications)
"""

from datetime import datetime, timezone
from beanie import Document, Indexed


class Notification(Document):
    """In-app notification pushed via WebSocket and stored for history.

    Created by other modules calling notifications.service.create_notification()
    directly — never by direct database insert from outside this module.
    """

    user_id: str = Indexed()
    type: str  # "group_transaction" | "budget_alert" | "income_received" | "expense_added"
    title: str
    body: str
    is_read: bool = False
    metadata: dict = {}  # { group_id, transaction_id, ... } — never null in DB
    created_at: datetime = Indexed()

    class Settings:
        name = "notifications"
        indexes = [
            ("user_id", "is_read", "created_at"),  # compound for list queries
        ]
        use_state_management = True