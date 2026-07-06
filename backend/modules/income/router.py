"""Income module — FastAPI routers and endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from core.deps import get_current_user
from modules.auth.models import User
from modules.income.schemas import (
    IncomeCreate,
    IncomeUpdate,
    IncomeResponse,
    IncomeListResponse,
)
from modules.income import service as income_service
from modules.income.models import Income


router = APIRouter(prefix="/api/v1/income", tags=["income"])


def income_to_response(income: Income) -> IncomeResponse:
    """Convert Beanie Income document to response schema."""
    return IncomeResponse(
        id=str(income.id),
        source_type=income.source_type,
        friend_id=income.friend_id,
        description=income.description,
        amount=income.amount,
        date=income.date.date(),  # Convert datetime to date
        payment_type=income.payment_type,
        created_at=income.created_at.isoformat(),
    )


# ===== CRUD =====

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_income(
    data: IncomeCreate,
    current_user: User = Depends(get_current_user),
) -> IncomeResponse:
    """Create a new income record."""
    income = await income_service.create_income(
        user_id=str(current_user.id),
        data=data,
    )
    return income_to_response(income)


@router.get("/", status_code=status.HTTP_200_OK)
async def list_income(
    source_type: str | None = None,
    payment_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: User = Depends(get_current_user),
) -> IncomeListResponse:
    """List income records with optional filters."""
    incomes = await income_service.list_income(
        user_id=str(current_user.id),
        source_type=source_type,
        payment_type=payment_type,
        date_from=date_from,
        date_to=date_to,
    )
    return IncomeListResponse(
        items=[income_to_response(i) for i in incomes],
        total=len(incomes),
    )


@router.get("/{income_id}", status_code=status.HTTP_200_OK)
async def get_income(
    income_id: str,
    current_user: User = Depends(get_current_user),
) -> IncomeResponse:
    """Get a single income record by ID."""
    income = await income_service.get_income(
        user_id=str(current_user.id),
        income_id=income_id,
    )
    if not income:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Income record not found.",
                "details": {},
            },
        )
    return income_to_response(income)


@router.put("/{income_id}", status_code=status.HTTP_200_OK)
async def update_income(
    income_id: str,
    data: IncomeUpdate,
    current_user: User = Depends(get_current_user),
) -> IncomeResponse:
    """Partially update an income record."""
    income = await income_service.update_income(
        user_id=str(current_user.id),
        income_id=income_id,
        data=data,
    )
    if not income:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Income record not found.",
                "details": {},
            },
        )
    return income_to_response(income)


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an income record."""
    deleted = await income_service.delete_income(
        user_id=str(current_user.id),
        income_id=income_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Income record not found.",
                "details": {},
            },
        )
