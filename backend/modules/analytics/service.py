"""Analytics module — Business logic services.

Locked per Spec-09 §1.2 and §1.3.
"""

from datetime import date as dt_date
from datetime import datetime, timezone
from decimal import Decimal
from operator import attrgetter
from typing import Any

from beanie import PydanticObjectId
from bson.decimal128 import Decimal128
from fastapi import HTTPException

from modules.expenses.models import Expense
from modules.income.models import Income
from modules.groups.models import Group, GroupTransaction
from modules.auth.models import User
from modules.analytics.schemas import (
    CategoryBreakdownResponse,
    CategoryBreakdownItem,
    IncomeBreakdownResponse,
    IncomeBreakdownItem,
    NetBalanceResponse,
    RecentActivityResponse,
    RecentActivityItem,
)
from shared.period_utils import get_period_range, now_in_ist, decimal_to_float


# ===== Helpers =====

def _parse_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal128):
        return value.to_decimal()
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value)) if value is not None else Decimal("0")


def _iso_range(start: datetime, end: datetime) -> dict[str, str]:
    return {"start": start.isoformat(), "end": end.isoformat()}


# ===== Breakdowns =====

async def get_expense_breakdown(user_id: str, period: str) -> CategoryBreakdownResponse:
    start, end = get_period_range(period, now_in_ist())

    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "date": {"$gte": start, "$lte": end},
            }
        },
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]

    results = await Expense.aggregate(pipeline).to_list()
    total = Decimal("0.00")
    items: list[CategoryBreakdownItem] = []

    for row in results:
        row_total = _parse_decimal(row.get("total"))
        total += row_total
        if row_total > 0:
            items.append(
                CategoryBreakdownItem(
                    category=str(row["_id"]),
                    total_amount=decimal_to_float(row_total),
                    percentage=0.0,  # computed after total is known
                )
            )

    # Compute percentages now that total is known
    if total > 0:
        for item in items:
            item.percentage = round((item.total_amount / decimal_to_float(total)) * 100, 1)

    return CategoryBreakdownResponse(
        period=period,
        range=_iso_range(start, end),
        breakdown=items,
        total=decimal_to_float(total),
    )


async def get_income_breakdown(user_id: str, period: str) -> IncomeBreakdownResponse:
    start, end = get_period_range(period, now_in_ist())

    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "date": {"$gte": start, "$lte": end},
            }
        },
        {"$group": {"_id": "$source_type", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]

    results = await Income.aggregate(pipeline).to_list()
    total = Decimal("0.00")
    items: list[IncomeBreakdownItem] = []

    for row in results:
        row_total = _parse_decimal(row.get("total"))
        total += row_total
        if row_total > 0:
            items.append(
                IncomeBreakdownItem(
                    source_type=str(row["_id"]),
                    total_amount=decimal_to_float(row_total),
                    percentage=0.0,
                )
            )

    if total > 0:
        for item in items:
            item.percentage = round((item.total_amount / decimal_to_float(total)) * 100, 1)

    return IncomeBreakdownResponse(
        period=period,
        range=_iso_range(start, end),
        breakdown=items,
        total=decimal_to_float(total),
    )


# ===== Net Balance =====

async def get_net_balance(user_id: str) -> NetBalanceResponse:
    expense_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    income_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]

    expense_result = await Expense.aggregate(expense_pipeline).to_list()
    income_result = await Income.aggregate(income_pipeline).to_list()

    total_expense = _parse_decimal(expense_result[0]["total"]) if expense_result else Decimal("0")
    total_income = _parse_decimal(income_result[0]["total"]) if income_result else Decimal("0")

    return NetBalanceResponse(
        total_income=decimal_to_float(total_income),
        total_expense=decimal_to_float(total_expense),
        net_balance=decimal_to_float(total_income - total_expense),
    )


# ===== Recent Activity =====

async def get_recent_activity(user_id: str, limit: int = 10) -> RecentActivityResponse:
    # Fetch candidates from each source, then merge in Python.
    # We fetch more than `limit` from each source to be safe.
    candidate_limit = max(limit * 3, 20)

    expenses = await Expense.find({"user_id": user_id}).sort("-date").limit(candidate_limit).to_list()
    incomes = await Income.find({"user_id": user_id}).sort("-date").limit(candidate_limit).to_list()

    # Group transactions where user OWES money (in splits, NOT paid_by)
    group_txs = await GroupTransaction.find(
        {"splits.user_id": user_id}
    ).sort("-date").limit(candidate_limit).to_list()

    group_ids = {gt.group_id for gt in group_txs}
    groups = {str(g.id): g for g in await Group.find({"_id": {"$in": [PydanticObjectId(gid) for gid in group_ids]}}).to_list()}

    items: list[RecentActivityItem] = []

    for expense in expenses:
        items.append(
            RecentActivityItem(
                type="expense",
                id=str(expense.id),
                description=expense.description,
                amount=decimal_to_float(expense.amount),
                date=expense.date.isoformat(),
                direction="out",
                created_at=expense.created_at.isoformat(),
            )
        )

    for income in incomes:
        items.append(
            RecentActivityItem(
                type="income",
                id=str(income.id),
                description=income.description,
                amount=decimal_to_float(income.amount),
                date=income.date.isoformat(),
                direction="in",
                created_at=income.created_at.isoformat(),
            )
        )

    for gt in group_txs:
        owed = next((s for s in gt.splits if s.user_id == user_id), None)
        if owed:
            group = groups.get(gt.group_id)
            items.append(
                RecentActivityItem(
                    type="group_transaction",
                    id=str(gt.id),
                    description=gt.description,
                    amount=decimal_to_float(owed.amount_owed),
                    date=gt.date.isoformat(),
                    direction="out",
                    created_at=gt.created_at.isoformat(),
                    group_id=gt.group_id,
                    group_name=group.name if group else None,
                )
            )

    def _sort_key(item: RecentActivityItem) -> datetime:
        # date is an UTC ISO 8601 string; parse and ensure timezone-aware
        dt = datetime.fromisoformat(item.date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    # Primary: date descending; secondary: created_at descending
    items.sort(
        key=lambda item: (
            _sort_key(item),
            datetime.fromisoformat(item.created_at) if item.created_at else datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )
    return RecentActivityResponse(items=items[:limit])


# ===== Report Data =====

async def generate_report_data(user_id: str, start_date: dt_date, end_date: dt_date) -> dict[str, Any]:
    """Gather all data needed for PDF/Excel reports."""
    start_dt = datetime.combine(start_date, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    end_dt = datetime.combine(end_date, datetime.max.time()).replace(
        tzinfo=timezone.utc
    )

    # Expenses
    expenses = await Expense.find(
        {
            "user_id": user_id,
            "date": {"$gte": start_dt, "$lte": end_dt},
        }
    ).sort(-Expense.date).to_list()

    # Income
    incomes = await Income.find(
        {
            "user_id": user_id,
            "date": {"$gte": start_dt, "$lte": end_dt},
        }
    ).sort(-Income.date).to_list()

    # Group transactions where user is paid_by or in splits
    group_txs = await GroupTransaction.find(
        {
            "$or": [
                {"paid_by": user_id},
                {"splits.user_id": user_id},
            ],
            "date": {"$gte": start_dt, "$lte": end_dt},
        }
    ).sort("-date").to_list()

    group_ids = {gt.group_id for gt in group_txs}
    groups = {str(g.id): g for g in await Group.find({"_id": {"$in": [PydanticObjectId(gid) for gid in group_ids]}}).to_list()}

    total_expense = sum((e.amount for e in expenses), Decimal("0"))
    total_income = sum((i.amount for i in incomes), Decimal("0"))

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "expenses": expenses,
        "income": incomes,
        "group_transactions": group_txs,
        "groups": groups,
        "total_expense": total_expense,
        "total_income": total_income,
        "net_balance": total_income - total_expense,
    }
