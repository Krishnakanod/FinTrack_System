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
