"""Budgets module — Business logic services."""

from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from bson.decimal128 import Decimal128
from fastapi import HTTPException

from modules.budgets.models import Budget
from modules.budgets.schemas import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetStatusResponse
from modules.expenses.models import Expense
from shared.enums import ExpenseCategory
from shared.period_utils import get_period_anchor, get_period_range, now_in_ist, decimal_to_float


# ===== Helpers =====

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

    # Apply category change
    if data.category is not None and data.category != budget.category:
        # Check for duplicate (user_id, new_category, period)
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
        budget.category = data.category
        changed = True

    # Apply period change
    if data.period is not None and data.period != budget.period:
        # Check for duplicate (user_id, category, new_period)
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
        budget.period = data.period
        changed = True

    # Apply amount change
    if data.amount is not None:
        budget.amount = data.amount
        changed = True

    if changed:
        # Always reset alert flags and recalculate period anchor on any change
        budget.alert_sent_80 = False
        budget.alert_sent_100 = False
        budget.period_anchor = get_period_anchor(budget.period, now)
        budget.updated_at = now
        await budget.save()

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
