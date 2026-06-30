"""Budgets module — FastAPI router."""

from fastapi import APIRouter, Depends, status

from core.deps import get_current_user
from modules.auth.models import User
from modules.budgets import service
from modules.budgets.schemas import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetStatusResponse,
    BudgetListResponse,
)

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget_endpoint(
    data: BudgetCreate,
    user: User = Depends(get_current_user),
):
    return await service.create_budget(str(user.id), data)


@router.get("/", response_model=BudgetListResponse)
async def list_budgets_endpoint(
    user: User = Depends(get_current_user),
):
    budgets = await service.list_budgets(str(user.id))
    return {"items": budgets}


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget_endpoint(
    budget_id: str,
    data: BudgetUpdate,
    user: User = Depends(get_current_user),
):
    return await service.update_budget(str(user.id), budget_id, data)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_endpoint(
    budget_id: str,
    user: User = Depends(get_current_user),
):
    await service.delete_budget(str(user.id), budget_id)


@router.get("/status", response_model=list[BudgetStatusResponse])
async def get_budget_status_endpoint(
    user: User = Depends(get_current_user),
):
    return await service.get_budget_status(str(user.id))
