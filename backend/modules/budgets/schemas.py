"""Budgets module — Pydantic request/response schemas."""

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

from shared.enums import ExpenseCategory


class BudgetCreate(BaseModel):
    category: ExpenseCategory
    period: Literal["daily", "monthly", "quarterly", "yearly"]
    amount: Decimal = Field(gt=0)


class BudgetUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    category: Optional[ExpenseCategory] = None
    period: Optional[Literal["daily", "monthly", "quarterly", "yearly"]] = None

    model_config = {"arbitrary_types_allowed": True}


class BudgetResponse(BaseModel):
    id: str
    category: ExpenseCategory
    period: Literal["daily", "monthly", "quarterly", "yearly"]
    amount: float
    alert_sent_80: bool
    alert_sent_100: bool
    created_at: str
    updated_at: str


class BudgetStatusResponse(BudgetResponse):
    current_spend: float
    percentage_used: float


class BudgetListResponse(BaseModel):
    items: list[BudgetResponse]


# ──────────────────────────────────────────────────────────────────────────────
# Budget History schemas
# ──────────────────────────────────────────────────────────────────────────────

class EditChange(BaseModel):
    """One field that changed in a single edit event."""
    field: str
    old_value: str
    new_value: str


class EditLogItem(BaseModel):
    """One edit event (may bundle multiple field changes)."""
    changed_at: str          # ISO datetime
    changes: list[EditChange]


class AlertLogItem(BaseModel):
    """One threshold alert that was fired by the scheduler."""
    threshold: str           # "80" | "100"
    spend_at_alert: float
    budget_amount: float
    fired_at: str            # ISO datetime


class DailySpend(BaseModel):
    """Total expenses for one calendar date in the current period."""
    date: str                # YYYY-MM-DD
    amount: float


class PastPeriodSummary(BaseModel):
    """Spending summary for one prior budget period."""
    period_anchor: str       # e.g. "2026-06", "2026-Q1", "2026"
    spent: float
    budget_amount: float     # budget limit that was active during this period
                             # (always current amount — edit history not back-filled)
    daily_breakdown: list[DailySpend] = []  # per-day totals within this past period


class BudgetHistoryResponse(BaseModel):
    budget_id: str
    created_at: str
    updated_at: str
    edit_logs: list[EditLogItem]
    alert_logs: list[AlertLogItem]
    daily_spending: list[DailySpend]        # current period, sorted date asc
    past_periods: list[PastPeriodSummary]   # up to 5 prior periods, newest first
