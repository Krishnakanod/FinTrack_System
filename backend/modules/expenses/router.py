"""Expense module — FastAPI routers and endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from datetime import date

from core.deps import get_current_user
from modules.auth.models import User
from modules.expenses.schemas import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    OcrUploadRequest,
    OcrResponse,
    OcrConfirmRequest,
    ExpenseListResponse,
)
from modules.expenses import service as expense_service
from modules.expenses.models import Expense


router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])


def expense_to_response(expense: Expense) -> ExpenseResponse:
    """Convert Beanie Expense document to response schema."""
    return ExpenseResponse(
        id=str(expense.id),
        category=expense.category,
        description=expense.description,
        amount=expense.amount,
        date=expense.date.date(),  # Convert datetime to date
        payment_type=expense.payment_type,
        source=expense.source,
        ocr_confidence=expense.ocr_confidence,
        receipt_image_url=expense.receipt_image_url,
        created_at=expense.created_at.isoformat(),
        updated_at=expense.updated_at.isoformat(),
    )


# ===== MANUAL EXPENSE CRUD =====

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    """Create a new manual expense."""
    expense = await expense_service.create_expense(
        user_id=str(current_user.id),
        data=data,
    )
    return expense_to_response(expense)


@router.get("/", status_code=status.HTTP_200_OK)
async def list_expenses(
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> ExpenseListResponse:
    """List expenses with optional filters."""
    expenses = await expense_service.list_expenses(
        user_id=str(current_user.id),
        category=category,
        date_from=date_from,
        date_to=date_to,
    )
    return ExpenseListResponse(
        items=[expense_to_response(e) for e in expenses],
        total=len(expenses),
    )


@router.get("/{expense_id}", status_code=status.HTTP_200_OK)
async def get_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    """Get a single expense by ID."""
    expense = await expense_service.get_expense(
        user_id=str(current_user.id),
        expense_id=expense_id,
    )
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Expense not found.",
                "details": {},
            },
        )
    return expense_to_response(expense)


@router.put("/{expense_id}", status_code=status.HTTP_200_OK)
async def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    """Partially update an expense."""
    expense = await expense_service.update_expense(
        user_id=str(current_user.id),
        expense_id=expense_id,
        data=data,
    )
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Expense not found.",
                "details": {},
            },
        )
    return expense_to_response(expense)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an expense."""
    deleted = await expense_service.delete_expense(
        user_id=str(current_user.id),
        expense_id=expense_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Expense not found.",
                "details": {},
            },
        )


# ===== OCR ENDPOINTS =====

@router.post("/ocr", status_code=status.HTTP_200_OK)
async def ocr_upload(
    data: OcrUploadRequest,
    current_user: User = Depends(get_current_user),
) -> OcrResponse:
    """Upload a receipt image for OCR processing (preview only — does NOT save)."""
    result = await expense_service.process_ocr(
        user_id=str(current_user.id),
        data=data,
    )
    return result


@router.post("/ocr/confirm", status_code=status.HTTP_201_CREATED)
async def ocr_confirm(
    data: OcrConfirmRequest,
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    """Confirm and save an OCR-parsed expense."""
    expense = await expense_service.confirm_ocr_expense(
        user_id=str(current_user.id),
        data=data,
    )
    return expense_to_response(expense)
