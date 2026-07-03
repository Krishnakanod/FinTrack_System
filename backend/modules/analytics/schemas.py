"""Analytics module — Pydantic request/response schemas.

Locked per Spec-09 §1.2.
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DateRange(BaseModel):
    start: str
    end: str


class CategoryBreakdownItem(BaseModel):
    category: str
    total_amount: float
    percentage: float


class CategoryBreakdownResponse(BaseModel):
    period: str
    range: DateRange
    breakdown: list[CategoryBreakdownItem]
    total: float


class IncomeBreakdownItem(BaseModel):
    source_type: str
    total_amount: float
    percentage: float


class IncomeBreakdownResponse(BaseModel):
    period: str
    range: DateRange
    breakdown: list[IncomeBreakdownItem]
    total: float


class NetBalanceResponse(BaseModel):
    total_income: float
    total_expense: float
    net_balance: float


class RecentActivityItem(BaseModel):
    type: Literal["expense", "income", "group_transaction"]
    id: str
    description: str
    amount: float
    date: str
    direction: Literal["in", "out"]
    created_at: str | None = None
    group_id: str | None = None
    group_name: str | None = None


class RecentActivityResponse(BaseModel):
    items: list[RecentActivityItem]


class ReportDownloadRequest(BaseModel):
    start_date: date
    end_date: date
    format: Literal["pdf", "excel"]
