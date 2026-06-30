"""Budgets module — Pydantic request/response schemas."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from shared.enums import ExpenseCategory


class BudgetCreate(BaseModel):
    category: ExpenseCategory
    period: Literal["daily", "monthly", "quarterly", "yearly"]
    amount: Decimal = Field(gt=0)


class BudgetUpdate(BaseModel):
    amount: Decimal = Field(gt=0)


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
