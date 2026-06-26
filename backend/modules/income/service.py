"""Income module — Business logic services."""

from datetime import datetime
from typing import Optional

from modules.income.models import Income
from modules.income.schemas import IncomeCreate, IncomeUpdate


# ===== CRUD =====

async def create_income(user_id: str, data: IncomeCreate) -> Income:
    """Create a new income record."""
    income = Income(
        user_id=user_id,
        source_type=data.source_type,
        friend_id=data.friend_id,
        description=data.description,
        amount=data.amount,
        date=data.date,
        payment_type=data.payment_type,
        created_at=datetime.utcnow(),
    )
    await income.insert()
    return income


async def list_income(
    user_id: str,
    source_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list[Income]:
    """List income records with optional filters. Sorted by date DESC."""
    from datetime import datetime

    query = {"user_id": user_id}

    if source_type:
        query["source_type"] = source_type

    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_filter["$lte"] = datetime.fromisoformat(date_to)
        query["date"] = date_filter

    incomes = await Income.find(query).sort("-date").to_list()
    return incomes


async def get_income(user_id: str, income_id: str) -> Optional[Income]:
    """Get a single income record by ID (must belong to user). Returns None if not found/owned."""
    try:
        from bson import ObjectId
        income = await Income.get(ObjectId(income_id))
    except Exception:
        return None

    if not income or income.user_id != user_id:
        return None
    return income


async def update_income(user_id: str, income_id: str, data: IncomeUpdate) -> Optional[Income]:
    """Partially update an income record. Returns None if not found/owned."""
    income = await get_income(user_id, income_id)
    if not income:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        for field, value in update_data.items():
            setattr(income, field, value)
        await income.save()

    return income


async def delete_income(user_id: str, income_id: str) -> bool:
    """Delete an income record. Returns True if deleted, False if not found/owned."""
    income = await get_income(user_id, income_id)
    if not income:
        return False
    await income.delete()
    return True
