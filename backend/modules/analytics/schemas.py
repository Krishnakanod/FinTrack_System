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
    paid_to_name: str | None = None
    source_name: str | None = None
    category: str | None = None
    group_id: str | None = None
    group_name: str | None = None


class RecentActivityResponse(BaseModel):
    items: list[RecentActivityItem]


class ReportDownloadRequest(BaseModel):
    start_date: date
    end_date: date
    format: Literal["pdf", "excel"]


# ===== Analytics overhaul schemas =====

class PersonalSummary(BaseModel):
    total_expenses: float
    total_income: float
    net_balance: float
    savings_rate: float | None = None


class IncomeExpenseBucket(BaseModel):
    label: str
    income: float
    expense: float


class TrendBucket(BaseModel):
    label: str
    amount: float


class PaymentTypeBreakdown(BaseModel):
    payment_type: str
    total_amount: float
    percentage: float


class TopCategory(BaseModel):
    rank: int
    category: str
    total_amount: float


class PersonalAnalyticsResponse(BaseModel):
    period: str
    range: DateRange
    summary: PersonalSummary
    income_vs_expense: list[IncomeExpenseBucket]
    spending_trend: list[TrendBucket]
    payment_type_breakdown: list[PaymentTypeBreakdown]
    top_categories: list[TopCategory]
    recent_activity: list[RecentActivityItem]


class MemberBalanceItem(BaseModel):
    label: str
    amount: float


class GroupSummary(BaseModel):
    total_spend: float
    your_contribution: float
    you_paid: float
    your_share: float
    unsettled_amount: float
    settled_amount: float


class MemberShareItem(BaseModel):
    member_name: str
    amount: float
    percentage: float


class GroupAnalyticsResponse(BaseModel):
    period: str
    range: DateRange
    summary: GroupSummary
    member_shares: list[MemberShareItem]
    member_balances: list[MemberBalanceItem]
    spending_trend: list[TrendBucket]
    recent_activity: list[RecentActivityItem]
