"""Budgets module — Business logic services."""

from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from bson.decimal128 import Decimal128
from fastapi import HTTPException

from modules.budgets.models import Budget
from modules.budgets.history_models import BudgetEditLog, BudgetAlertLog, FieldChange
from modules.budgets.schemas import (
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetStatusResponse,
    BudgetHistoryResponse, EditLogItem, EditChange, AlertLogItem,
    DailySpend, PastPeriodSummary,
)
from modules.expenses.models import Expense
from shared.enums import ExpenseCategory
from shared.period_utils import get_period_anchor, get_period_range, now_in_ist, decimal_to_float


# ===== Helpers =====

def _agg_to_float(val) -> float:
    """Safely convert any MongoDB aggregation total to float.

    MongoDB's $sum over a Decimal128 field returns Decimal128, not Python Decimal.
    decimal_to_float() does not handle Decimal128 — this wrapper covers all cases.
    """
    if val is None:
        return 0.0
    if isinstance(val, Decimal128):
        return float(val.to_decimal())
    if isinstance(val, Decimal):
        return float(val)
    return float(val)

def _budget_to_response(budget: Budget) -> BudgetResponse:
    return BudgetResponse(
        id=str(budget.id),
        category=budget.category,
        period=budget.period,
        amount=decimal_to_float(budget.amount),
        alert_sent_80=budget.alert_sent_80,
        alert_sent_100=budget.alert_sent_100,
        created_at=budget.created_at.isoformat(),
        updated_at=budget.updated_at.isoformat(),
    )


def _budget_to_status_response(budget: Budget, current_spend: Decimal) -> BudgetStatusResponse:
    percentage_used = round((decimal_to_float(current_spend) / decimal_to_float(budget.amount)) * 100, 1) if budget.amount else 0.0
    return BudgetStatusResponse(
        id=str(budget.id),
        category=budget.category,
        period=budget.period,
        amount=decimal_to_float(budget.amount),
        alert_sent_80=budget.alert_sent_80,
        alert_sent_100=budget.alert_sent_100,
        current_spend=decimal_to_float(current_spend),
        percentage_used=percentage_used,
        created_at=budget.created_at.isoformat(),
        updated_at=budget.updated_at.isoformat(),
    )


async def get_current_spend(user_id: str, category: ExpenseCategory, period: str) -> Decimal:
    """Sum expenses for the user in the given category and current period (IST)."""
    start, end = get_period_range(period, now_in_ist())

    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "category": category.value if isinstance(category, ExpenseCategory) else category,
                "date": {"$gte": start, "$lte": end},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]

    result = await Expense.aggregate(pipeline).to_list()
    if not result or result[0].get("total") is None:
        return Decimal("0.00")

    total = result[0]["total"]
    if isinstance(total, Decimal128):
        return total.to_decimal()
    if isinstance(total, Decimal):
        return total
    return Decimal(str(total))


# ===== CRUD =====

async def create_budget(user_id: str, data: BudgetCreate) -> BudgetResponse:
    now = now_in_ist()
    anchor = get_period_anchor(data.period, now)

    duplicate = await Budget.find_one({
        "user_id": user_id,
        "category": data.category,
        "period": data.period,
    })
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "BUDGET_ALREADY_EXISTS",
                "message": "A budget for this category and period already exists. Edit it instead.",
                "details": {},
            },
        )

    budget = Budget(
        user_id=user_id,
        category=data.category,
        period=data.period,
        amount=data.amount,
        alert_sent_80=False,
        alert_sent_100=False,
        period_anchor=anchor,
        created_at=now,
        updated_at=now,
    )

    try:
        await budget.insert()
    except Exception as exc:
        # Unique compound index on (user_id, category, period)
        raise HTTPException(
            status_code=409,
            detail={
                "error": "BUDGET_ALREADY_EXISTS",
                "message": "A budget for this category and period already exists. Edit it instead.",
                "details": {},
            },
        ) from exc

    return _budget_to_response(budget)


async def list_budgets(user_id: str) -> list[BudgetResponse]:
    budgets = await Budget.find({"user_id": user_id}).to_list()
    return [_budget_to_response(b) for b in budgets]


async def update_budget(user_id: str, budget_id: str, data: BudgetUpdate) -> BudgetResponse:
    budget = await Budget.find_one({"_id": PydanticObjectId(budget_id), "user_id": user_id})
    if not budget:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": "Budget not found.", "details": {}},
        )

    now = now_in_ist()
    changed = False
    field_changes: list[FieldChange] = []

    # Apply category change
    if data.category is not None and data.category != budget.category:
        new_period = data.period if data.period is not None else budget.period
        duplicate = await Budget.find_one({
            "user_id": user_id,
            "category": data.category,
            "period": new_period,
            "_id": {"$ne": budget.id},
        })
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "BUDGET_ALREADY_EXISTS",
                    "message": "A budget for this category and period already exists.",
                    "details": {},
                },
            )
        field_changes.append(FieldChange(
            field="category",
            old_value=str(budget.category.value if hasattr(budget.category, 'value') else budget.category),
            new_value=str(data.category.value if hasattr(data.category, 'value') else data.category),
        ))
        budget.category = data.category
        changed = True

    # Apply period change
    if data.period is not None and data.period != budget.period:
        new_category = data.category if data.category is not None else budget.category
        duplicate = await Budget.find_one({
            "user_id": user_id,
            "category": new_category,
            "period": data.period,
            "_id": {"$ne": budget.id},
        })
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "BUDGET_ALREADY_EXISTS",
                    "message": "A budget for this category and period already exists.",
                    "details": {},
                },
            )
        field_changes.append(FieldChange(
            field="period",
            old_value=str(budget.period),
            new_value=str(data.period),
        ))
        budget.period = data.period
        changed = True

    # Apply amount change
    if data.amount is not None:
        old_amount = decimal_to_float(budget.amount)
        new_amount = decimal_to_float(data.amount)
        if abs(old_amount - new_amount) > 0.0001:
            field_changes.append(FieldChange(
                field="amount",
                old_value=str(old_amount),
                new_value=str(new_amount),
            ))
        budget.amount = data.amount
        changed = True

    if changed:
        budget.alert_sent_80 = False
        budget.alert_sent_100 = False
        budget.period_anchor = get_period_anchor(budget.period, now)
        budget.updated_at = now
        await budget.save()

        # Write edit log if at least one field actually differed in value
        if field_changes:
            edit_log = BudgetEditLog(
                budget_id=budget_id,
                user_id=user_id,
                changed_at=now,
                changes=field_changes,
            )
            await edit_log.insert()

    return _budget_to_response(budget)


async def delete_budget(user_id: str, budget_id: str) -> None:
    budget = await Budget.find_one({"_id": PydanticObjectId(budget_id), "user_id": user_id})
    if not budget:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": "Budget not found.", "details": {}},
        )
    await budget.delete()


async def get_budget_status(user_id: str) -> list[BudgetStatusResponse]:
    budgets = await Budget.find({"user_id": user_id}).to_list()
    statuses = []
    for budget in budgets:
        spend = await get_current_spend(user_id, budget.category, budget.period)
        statuses.append(_budget_to_status_response(budget, spend))
    return statuses


# ──────────────────────────────────────────────────────────────────────────────
# Budget History
# ──────────────────────────────────────────────────────────────────────────────

def _prior_period_anchors(period: str, current_anchor: str, count: int = 5) -> list[str]:
    """Return up to `count` period anchor strings immediately before current_anchor."""
    from datetime import date, timedelta
    import calendar

    anchors = []
    ref_anchor = current_anchor

    for _ in range(count):
        if period == "daily":
            d = date.fromisoformat(ref_anchor)
            prev = d - timedelta(days=1)
            ref_anchor = prev.strftime("%Y-%m-%d")

        elif period == "monthly":
            year, month = map(int, ref_anchor.split("-"))
            if month == 1:
                year, month = year - 1, 12
            else:
                month -= 1
            ref_anchor = f"{year}-{month:02d}"

        elif period == "quarterly":
            year, q = int(ref_anchor.split("-Q")[0]), int(ref_anchor.split("-Q")[1])
            if q == 1:
                year, q = year - 1, 4
            else:
                q -= 1
            ref_anchor = f"{year}-Q{q}"

        elif period == "yearly":
            ref_anchor = str(int(ref_anchor) - 1)

        else:
            break  # unknown period

        anchors.append(ref_anchor)

    return anchors


async def get_budget_history(user_id: str, budget_id: str) -> BudgetHistoryResponse:
    """Assemble the full budget history payload for the history side-sheet."""
    budget = await Budget.find_one({"_id": PydanticObjectId(budget_id), "user_id": user_id})
    if not budget:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": "Budget not found.", "details": {}},
        )

    now = now_in_ist()

    # ── 1. Edit logs ──────────────────────────────────────────────────────────
    raw_edit_logs = await BudgetEditLog.find(
        {"budget_id": budget_id}
    ).sort(-BudgetEditLog.changed_at).to_list()

    edit_logs = [
        EditLogItem(
            changed_at=log.changed_at.isoformat(),
            changes=[
                EditChange(field=c.field, old_value=c.old_value, new_value=c.new_value)
                for c in log.changes
            ],
        )
        for log in raw_edit_logs
    ]

    # ── 2. Alert logs ─────────────────────────────────────────────────────────
    raw_alert_logs = await BudgetAlertLog.find(
        {"budget_id": budget_id}
    ).sort(-BudgetAlertLog.fired_at).to_list()

    alert_logs = [
        AlertLogItem(
            threshold=log.threshold,
            spend_at_alert=log.spend_at_alert,
            budget_amount=log.budget_amount,
            fired_at=log.fired_at.isoformat(),
        )
        for log in raw_alert_logs
    ]

    # ── 3. Daily spending for the current period ───────────────────────────────
    start, end = get_period_range(budget.period, now)
    category_str = budget.category.value if hasattr(budget.category, "value") else str(budget.category)

    daily_pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "category": category_str,
                "date": {"$gte": start, "$lte": end},
            }
        },
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date", "timezone": "Asia/Kolkata"}},
                "total": {"$sum": "$amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    daily_raw = await Expense.aggregate(daily_pipeline).to_list()
    daily_spending = [
        DailySpend(
            date=row["_id"],
            amount=_agg_to_float(row["total"]),
        )
        for row in daily_raw
    ]

    # ── 4. Past period summaries (up to 5) ────────────────────────────────────
    current_anchor = get_period_anchor(budget.period, now)
    prior_anchors = _prior_period_anchors(budget.period, current_anchor, count=5)

    def _get_historical_budget_amount(p_end_dt) -> float:
        """Reconstruct budget amount active at p_end_dt by walking edit logs backwards."""
        current_amt = float(budget.amount)
        # raw_edit_logs is already sorted by changed_at DESC (newest first)
        for log in raw_edit_logs:
            if log.changed_at > p_end_dt:
                # Undo this edit
                for change in log.changes:
                    if change.field == "amount":
                        current_amt = float(change.old_value)
            else:
                # This edit happened before or at our target time; stop undoing.
                break
        return current_amt

    past_periods: list[PastPeriodSummary] = []
    for anchor in prior_anchors:
        # Reconstruct the date range for this past anchor using a reference date
        # that falls within that period.
        try:
            ref_date = _anchor_to_reference_date(budget.period, anchor)
        except ValueError:
            continue

        from datetime import datetime as _dt, timezone as _tz
        ref_dt = _dt.combine(ref_date, _dt.min.time()).replace(tzinfo=now_in_ist().tzinfo)
        p_start, p_end = get_period_range(budget.period, ref_dt)

        past_pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "category": category_str,
                    "date": {"$gte": p_start, "$lte": p_end},
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        past_raw = await Expense.aggregate(past_pipeline).to_list()
        spent = 0.0
        if past_raw and past_raw[0].get("total") is not None:
            spent = _agg_to_float(past_raw[0]["total"])

        # Daily breakdown for this past period (for expandable detail view)
        daily_past_pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "category": category_str,
                    "date": {"$gte": p_start, "$lte": p_end},
                }
            },
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date", "timezone": "Asia/Kolkata"}},
                    "total": {"$sum": "$amount"},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        daily_past_raw = await Expense.aggregate(daily_past_pipeline).to_list()
        past_daily_breakdown = [
            DailySpend(date=row["_id"], amount=_agg_to_float(row["total"]))
            for row in daily_past_raw
        ]

        past_periods.append(PastPeriodSummary(
            period_anchor=anchor,
            spent=spent,
            budget_amount=_get_historical_budget_amount(p_end),
            daily_breakdown=past_daily_breakdown,
        ))

    return BudgetHistoryResponse(
        budget_id=budget_id,
        created_at=budget.created_at.isoformat(),
        updated_at=budget.updated_at.isoformat(),
        edit_logs=edit_logs,
        alert_logs=alert_logs,
        daily_spending=daily_spending,
        past_periods=past_periods,
    )


def _anchor_to_reference_date(period: str, anchor: str):
    """Given a period anchor string, return a date object that falls within it."""
    from datetime import date
    if period == "daily":
        return date.fromisoformat(anchor)
    if period == "monthly":
        year, month = map(int, anchor.split("-"))
        return date(year, month, 1)
    if period == "quarterly":
        year, q = int(anchor.split("-Q")[0]), int(anchor.split("-Q")[1])
        month = (q - 1) * 3 + 1
        return date(year, month, 1)
    if period == "yearly":
        return date(int(anchor), 1, 1)
    raise ValueError(f"Unknown period: {period}")
