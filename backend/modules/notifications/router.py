"""Notifications module — FastAPI router."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from core.deps import get_current_user
from modules.auth.models import User
from modules.notifications import service
from modules.notifications.schemas import NotificationListResponse, NotificationResponse

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications_endpoint(
    is_read: Optional[bool] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
):
    return await service.list_notifications(str(user.id), is_read, limit, offset)


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read_endpoint(
    notification_id: str,
    user: User = Depends(get_current_user),
):
    return await service.mark_as_read(str(user.id), notification_id)


@router.put("/read-all", response_model=dict)
async def mark_all_as_read_endpoint(
    user: User = Depends(get_current_user),
):
    updated_count = await service.mark_all_as_read(str(user.id))
    return {"updated_count": updated_count}
