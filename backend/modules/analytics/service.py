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
    DateRange,
    PersonalSummary,
    IncomeExpenseBucket,
    TrendBucket,
    PaymentTypeBreakdown,
    TopCategory,
    PersonalAnalyticsResponse,
    GroupSummary,
    MemberShareItem,
    MemberBalanceItem,
    GroupAnalyticsResponse,
)
from shared.period_utils import get_period_range, get_period_anchor, now_in_ist, decimal_to_float


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

async def get_recent_activity(
    user_id: str, limit: int = 10, mode: str = "all", start: datetime | None = None, end: datetime | None = None
) -> RecentActivityResponse:
    # Fetch candidates from each source, then merge in Python.
    # We fetch more than `limit` from each source to be safe.
    candidate_limit = max(limit * 3, 20)

    items: list[RecentActivityItem] = []

    if mode in ("all", "personal"):
        query: dict[str, Any] = {"user_id": user_id}
        if start and end:
            query["date"] = {"$gte": start, "$lte": end}

        expenses = await Expense.find(query).sort("-date").limit(candidate_limit).to_list()
        incomes = await Income.find(query).sort("-date").limit(candidate_limit).to_list()

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
                    paid_to_name=expense.paid_to_name,
                    category=expense.category.value if hasattr(expense.category, "value") else expense.category,
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
                    source_name=income.source_name,
                    category=income.source_type.value if hasattr(income.source_type, "value") else income.source_type,
                )
            )

    if mode in ("all", "group"):
        # Group transactions where user OWES money (in splits, NOT paid_by)
        group_query: dict[str, Any] = {"splits.user_id": user_id}
        if start and end:
            group_query["date"] = {"$gte": start, "$lte": end}

        group_txs = await GroupTransaction.find(
            group_query
        ).sort("-date").limit(candidate_limit).to_list()

        group_ids = {gt.group_id for gt in group_txs}
        groups = {str(g.id): g for g in await Group.find({"_id": {"$in": [PydanticObjectId(gid) for gid in group_ids]}}).to_list()}

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


async def get_personal_analytics(user_id: str, period: str) -> PersonalAnalyticsResponse:
    from collections import defaultdict

    start, end = get_period_range(period, now_in_ist())
    start_str = start.isoformat()
    end_str = end.isoformat()

    # Fetch expenses and income within the period
    expenses = await Expense.find(
        {
            "user_id": user_id,
            "date": {"$gte": start, "$lte": end},
        }
    ).sort("-date").to_list()

    incomes = await Income.find(
        {
            "user_id": user_id,
            "date": {"$gte": start, "$lte": end},
        }
    ).sort("-date").to_list()

    total_expense = sum((e.amount for e in expenses), Decimal("0"))
    total_income = sum((i.amount for i in incomes), Decimal("0"))
    net_balance = total_income - total_expense
    savings_rate = None
    if total_income > 0:
        savings_rate = round(float(net_balance) / float(total_income) * 100, 1)

    # Bucket income vs expense
    income_buckets: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    expense_buckets: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    bucket_period = "daily" if period in ("daily", "weekly", "monthly") else "monthly"

    for income in incomes:
        bucket = get_period_anchor(bucket_period, income.date)
        income_buckets[bucket] += income.amount
    for expense in expenses:
        bucket = get_period_anchor(bucket_period, expense.date)
        expense_buckets[bucket] += expense.amount

    all_buckets = sorted(set(income_buckets.keys()) | set(expense_buckets.keys()))
    income_vs_expense = [
        IncomeExpenseBucket(
            label=b,
            income=decimal_to_float(income_buckets[b]),
            expense=decimal_to_float(expense_buckets[b]),
        )
        for b in all_buckets
    ]

    spending_trend = [
        TrendBucket(label=b, amount=decimal_to_float(expense_buckets[b]))
        for b in all_buckets
    ]

    # Payment type breakdown
    payment_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for expense in expenses:
        payment_totals[expense.payment_type] += expense.amount
    total_payment = sum(payment_totals.values(), Decimal("0"))
    payment_type_breakdown = [
        PaymentTypeBreakdown(
            payment_type=pt,
            total_amount=decimal_to_float(amount),
            percentage=round(decimal_to_float(amount) / decimal_to_float(total_payment) * 100, 1)
            if total_payment > 0 else 0.0,
        )
        for pt, amount in sorted(payment_totals.items(), key=lambda x: x[1], reverse=True)
    ]

    # Top 3 categories
    category_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for expense in expenses:
        category_totals[expense.category] += expense.amount
    top_categories = [
        TopCategory(rank=idx + 1, category=cat, total_amount=decimal_to_float(amount))
        for idx, (cat, amount) in enumerate(
            sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:3]
        )
    ]

    # Recent activity (limit 10) - personal only
    recent = await get_recent_activity(user_id, limit=10, mode="personal", start=start, end=end)

    return PersonalAnalyticsResponse(
        period=period,
        range=DateRange(start=start_str, end=end_str),
        summary=PersonalSummary(
            total_expenses=decimal_to_float(total_expense),
            total_income=decimal_to_float(total_income),
            net_balance=decimal_to_float(net_balance),
            savings_rate=savings_rate,
        ),
        income_vs_expense=income_vs_expense,
        spending_trend=spending_trend,
        payment_type_breakdown=payment_type_breakdown,
        top_categories=top_categories,
        recent_activity=recent.items,
    )


async def get_group_analytics(
    user_id: str, group_id: str, period: str
) -> GroupAnalyticsResponse:
    from collections import defaultdict

    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    start, end = get_period_range(period, now_in_ist())
    start_str = start.isoformat()
    end_str = end.isoformat()

    # Fetch group transactions in the period
    transactions = await GroupTransaction.find(
        {
            "group_id": group_id,
            "date": {"$gte": start, "$lte": end},
        }
    ).sort("-date").to_list()

    total_spend = sum((t.total_amount for t in transactions), Decimal("0"))
    you_paid = sum(
        (t.total_amount for t in transactions if t.paid_by == user_id), Decimal("0")
    )

    # The user's share is the sum of their own splits across transactions
    your_share = Decimal("0")
    for t in transactions:
        for split in t.splits:
            if split.user_id == user_id:
                your_share += split.amount_owed

    unsettled_amount = Decimal("0")
    settled_amount = Decimal("0")
    member_shares_dict: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for t in transactions:
        for split in t.splits:
            member_shares_dict[split.user_id] += split.amount_owed
            if split.is_settled:
                settled_amount += split.amount_owed
            else:
                unsettled_amount += split.amount_owed

    member_users = await User.find({"_id": {"$in": [PydanticObjectId(uid) for uid in group.members]}}).to_list()
    member_names = {str(u.id): u.name for u in member_users}

    total_shares = sum(member_shares_dict.values(), Decimal("0"))
    member_shares = []
    if total_shares > 0:
        for member_id, amount in sorted(member_shares_dict.items(), key=lambda x: x[1], reverse=True):
            member_shares.append(
                MemberShareItem(
                    member_name=member_names.get(member_id, "Unknown"),
                    amount=decimal_to_float(amount),
                    percentage=round(decimal_to_float(amount) / decimal_to_float(total_shares) * 100, 1),
                )
            )

    # Member-to-Member Balances
    pairwise_balances: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0"))
    for t in transactions:
        payer = t.paid_by
        for split in t.splits:
            debtor = split.user_id
            if debtor != payer and not split.is_settled:
                if debtor < payer:
                    pairwise_balances[(debtor, payer)] += split.amount_owed
                else:
                    pairwise_balances[(payer, debtor)] -= split.amount_owed

    member_balances = []
    for (a_id, b_id), net in pairwise_balances.items():
        if net == Decimal("0"):
            continue
        a_name = member_names.get(a_id, "Unknown")
        b_name = member_names.get(b_id, "Unknown")
        if net > 0:
            label = f"{a_name} owes {b_name}"
            amount = net
        else:
            label = f"{b_name} owes {a_name}"
            amount = -net
        
        member_balances.append(
            MemberBalanceItem(
                label=label,
                amount=decimal_to_float(amount)
            )
        )
    member_balances.sort(key=lambda x: x.amount, reverse=True)

    # Spending trend
    spending_buckets: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    bucket_period = "daily" if period in ("daily", "weekly", "monthly") else "monthly"
    for t in transactions:
        bucket = get_period_anchor(bucket_period, t.date)
        spending_buckets[bucket] += t.total_amount
    spending_trend = [
        TrendBucket(label=b, amount=decimal_to_float(amount))
        for b, amount in sorted(spending_buckets.items())
    ]

    # Recent group activity (limit 10)
    recent_items: list[RecentActivityItem] = []
    for t in transactions[:10]:
        recent_items.append(
            RecentActivityItem(
                type="group_transaction",
                id=str(t.id),
                description=t.description,
                amount=decimal_to_float(t.total_amount),
                date=t.date.isoformat(),
                direction="out",
                created_at=t.created_at.isoformat() if t.created_at else None,
                group_id=group_id,
                group_name=group.name,
            )
        )

    return GroupAnalyticsResponse(
        period=period,
        range=DateRange(start=start_str, end=end_str),
        summary=GroupSummary(
            total_spend=decimal_to_float(total_spend),
            your_contribution=decimal_to_float(your_share),
            you_paid=decimal_to_float(you_paid),
            your_share=decimal_to_float(your_share),
            unsettled_amount=decimal_to_float(unsettled_amount),
            settled_amount=decimal_to_float(settled_amount),
        ),
        member_shares=member_shares,
        member_balances=member_balances,
        spending_trend=spending_trend,
        recent_activity=recent_items,
    )
