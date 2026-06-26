"""Expense module — Business logic services."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from modules.expenses.models import Expense
from modules.expenses.schemas import (
    ExpenseCreate,
    ExpenseUpdate,
    OcrUploadRequest,
    OcrConfirmRequest,
    OcrResponse,
)
from modules.expenses.ocr import process_receipt


# ===== CRUD =====

async def create_expense(user_id: str, data: ExpenseCreate) -> Expense:
    """Create a new manual expense."""
    now = datetime.utcnow()
    expense = Expense(
        user_id=user_id,
        category=data.category,
        description=data.description,
        amount=data.amount,
        date=data.date,
        payment_type=data.payment_type,
        source="manual",
        ocr_confidence=None,
        receipt_image_url=None,
        created_at=now,
        updated_at=now,
    )
    await expense.insert()
    return expense


async def process_ocr(user_id: str, data: OcrUploadRequest) -> OcrResponse:
    """Process a receipt image via OCR (preview only — does NOT save)."""
    result = process_receipt(data.image_base64)

    if result["amount"] is None and result["date"] is None and result["merchant"] is None:
        # No text detected — return empty result per App-Flow.md §5
        return OcrResponse(
            amount=None,
            date=None,
            merchant=None,
            raw_text=result["raw_text"],
            confidence_score=0.0,
        )

    return OcrResponse(
        amount=result["amount"],
        date=result["date"],
        merchant=result["merchant"],
        raw_text=result["raw_text"],
        confidence_score=result["confidence_score"],
    )


async def confirm_ocr_expense(user_id: str, data: OcrConfirmRequest) -> Expense:
    """Save an OCR-parsed expense to the database."""
    now = datetime.utcnow()
    expense = Expense(
        user_id=user_id,
        category=data.category,
        description=data.description,
        amount=data.amount,
        date=data.date,
        payment_type=data.payment_type,
        source="ocr",
        ocr_confidence=data.ocr_confidence,
        receipt_image_url=None,
        created_at=now,
        updated_at=now,
    )
    await expense.insert()
    return expense


async def list_expenses(
    user_id: str,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list[Expense]:
    """List expenses with optional filters. Sorted by date DESC."""
    from datetime import datetime

    query = {"user_id": user_id}

    if category:
        query["category"] = category

    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_filter["$lte"] = datetime.fromisoformat(date_to)
        query["date"] = date_filter

    expenses = await Expense.find(query).sort("-date").to_list()
    return expenses


async def get_expense(user_id: str, expense_id: str) -> Optional[Expense]:
    """Get a single expense by ID (must belong to user). Returns None if not found/owned."""
    try:
        from bson import ObjectId
        expense = await Expense.get(ObjectId(expense_id))
    except Exception:
        return None

    if not expense or expense.user_id != user_id:
        return None
    return expense


async def update_expense(user_id: str, expense_id: str, data: ExpenseUpdate) -> Optional[Expense]:
    """Partially update an expense. Returns None if not found/owned."""
    expense = await get_expense(user_id, expense_id)
    if not expense:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        for field, value in update_data.items():
            setattr(expense, field, value)
        expense.updated_at = datetime.utcnow()
        await expense.save()

    return expense


async def delete_expense(user_id: str, expense_id: str) -> bool:
    """Delete an expense. Returns True if deleted, False if not found/owned."""
    expense = await get_expense(user_id, expense_id)
    if not expense:
        return False
    await expense.delete()
    return True
