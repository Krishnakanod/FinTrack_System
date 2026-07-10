"""Budgets module — History log models.

BudgetEditLog  : written on every update_budget() call that changes a field.
BudgetAlertLog : written every time the scheduler fires an 80% or 100% alert.

These are append-only collections; records are never mutated after insert.
"""

from datetime import datetime
from typing import Literal

from beanie import Document, Indexed
from pydantic import BaseModel


# ──────────────────────────────────────────────────────────────────────────────
# Sub-document (not a Document itself, just a nested schema)
# ──────────────────────────────────────────────────────────────────────────────

class FieldChange(BaseModel):
    """Records a single field change within one edit event."""
    field: str       # e.g. "amount", "category", "period"
    old_value: str   # string representation of the old value
    new_value: str   # string representation of the new value


# ──────────────────────────────────────────────────────────────────────────────
# BudgetEditLog
# ──────────────────────────────────────────────────────────────────────────────

class BudgetEditLog(Document):
    """Immutable record of one edit event on a Budget document.

    One document is created per update_budget() call that modifies at least
    one field.  Multiple field changes in the same call are bundled into a
    single log entry (the `changes` list).
    """

    budget_id: str = Indexed()
    user_id:   str = Indexed()
    changed_at: datetime
    changes: list[FieldChange]  # ≥1 entry per log document

    class Settings:
        name = "budget_edit_logs"
        indexes = [
            [("budget_id", 1), ("changed_at", -1)],  # history fetch per budget
            [("user_id", 1)],
        ]


# ──────────────────────────────────────────────────────────────────────────────
# BudgetAlertLog
# ──────────────────────────────────────────────────────────────────────────────

class BudgetAlertLog(Document):
    """Immutable record of one budget threshold alert that was fired.

    Written by the APScheduler job immediately after the notification is sent.
    """

    budget_id:      str = Indexed()
    user_id:        str
    threshold:      Literal["80", "100"]
    spend_at_alert: float   # current_spend at the moment the alert fired
    budget_amount:  float   # budget.amount at the moment the alert fired
    fired_at:       datetime

    class Settings:
        name = "budget_alert_logs"
        indexes = [
            [("budget_id", 1), ("fired_at", -1)],  # history fetch per budget
            [("user_id", 1)],
        ]
