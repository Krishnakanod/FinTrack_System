"""Groups module — FastAPI routers and endpoints.

Routes mounted under:
- /api/v1/groups/groups
- /api/v1/balances

Locked contracts per Spec-07 §1.6 and §1.7.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.deps import get_current_user
from modules.auth.models import User
from modules.groups import service as groups_service
from modules.groups.schemas import (
    GroupCreate,
    GroupUpdate,
    AddMemberRequest,
    GroupTransactionCreate,
    GroupResponse,
    GroupListResponse,
    GroupTransactionResponse,
    GroupTransactionListResponse,
    BalanceListResponse,
    BalanceResponse,
)


router = APIRouter(prefix="/api/v1", tags=["groups"])


# ===== Groups =====

@router.post("/groups/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    """Create a new group. Creator is automatically included in members."""
    return await groups_service.create_group(str(current_user.id), data)


@router.get("/groups/groups", status_code=status.HTTP_200_OK)
async def list_groups(
    current_user: User = Depends(get_current_user),
) -> GroupListResponse:
    """List all groups the current user is a member of."""
    items = await groups_service.list_groups(str(current_user.id))
    return GroupListResponse(items=items)


@router.get("/groups/groups/{group_id}", status_code=status.HTTP_200_OK)
async def get_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    """Get a single group by ID. 403 if not a member."""
    try:
        return await groups_service.get_group(str(current_user.id), group_id)
    except ValueError as e:
        error_code = str(e)
        if error_code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        # NOT_FOUND or any other
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


@router.put("/groups/groups/{group_id}", status_code=status.HTTP_200_OK)
async def update_group(
    group_id: str,
    data: GroupUpdate,
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    """Update group name/description."""
    try:
        return await groups_service.update_group(str(current_user.id), group_id, data)
    except ValueError as e:
        code = str(e)
        if code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        if code == "NOT_AUTHORIZED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_AUTHORIZED",
                    "message": "Only the group creator can rename the group.",
                    "details": {},
                },
            )
        if code == "INVALID_NAME_LENGTH":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "INVALID_NAME_LENGTH",
                    "message": "Group name must be between 3 and 50 characters.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


@router.post("/groups/groups/{group_id}/members", status_code=status.HTTP_200_OK)
async def add_member(
    group_id: str,
    data: AddMemberRequest,
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    """Add a member to a group. New member must be a friend of the requester."""
    try:
        return await groups_service.add_member(str(current_user.id), group_id, data)
    except ValueError as e:
        code = str(e)
        if code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        if code == "ALREADY_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "ALREADY_MEMBER",
                    "message": "User is already a member of this group.",
                    "details": {},
                },
            )
        if code == "NOT_FRIEND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "NOT_FRIEND",
                    "message": "You can only add friends to a group.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


@router.delete("/groups/groups/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a group."""
    try:
        await groups_service.remove_member(str(current_user.id), group_id, member_id)
    except ValueError as e:
        if str(e) == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


# ===== Group Transactions =====

@router.post("/groups/groups/{group_id}/transactions", status_code=status.HTTP_201_CREATED)
async def add_transaction(
    group_id: str,
    data: GroupTransactionCreate,
    current_user: User = Depends(get_current_user),
) -> GroupTransactionResponse:
    """Add a transaction to a group with equal or custom splits."""
    try:
        return await groups_service.add_transaction(
            str(current_user.id),
            group_id,
            data,
            actor_name=current_user.name,
        )
    except HTTPException as http_exc:
        # Re-raise validation/SPLIT_MISMATCH exceptions as-is
        raise http_exc
    except ValueError as e:
        code = str(e)
        if code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        if code == "PAID_BY_NOT_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "PAID_BY_NOT_MEMBER",
                    "message": "The payer must be a member of this group.",
                    "details": {},
                },
            )
        if code == "SPLIT_MISMATCH":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "SPLIT_MISMATCH",
                    "message": "Split amounts must sum to the total amount.",
                    "details": {},
                },
            )
        if code in ("SPLIT_AMONG_EMPTY", "SPLITS_EMPTY", "DUPLICATE_SPLIT_USER", "INVALID_SPLIT_USER"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Invalid split configuration.",
                    "details": {"reason": code},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


@router.get("/groups/groups/{group_id}/transactions", status_code=status.HTTP_200_OK)
async def list_group_transactions(
    group_id: str,
    current_user: User = Depends(get_current_user),
) -> GroupTransactionListResponse:
    """List transactions for a group, sorted by date descending."""
    try:
        items = await groups_service.list_group_transactions(str(current_user.id), group_id)
        return GroupTransactionListResponse(items=items)
    except ValueError as e:
        if str(e) == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group not found.",
                "details": {},
            },
        )


@router.put("/groups/groups/{group_id}/transactions/{transaction_id}", status_code=status.HTTP_200_OK)
async def update_group_transaction(
    group_id: str,
    transaction_id: str,
    data: GroupTransactionCreate,
    current_user: User = Depends(get_current_user),
) -> GroupTransactionResponse:
    """Update a group transaction (only the payer can edit)."""
    try:
        return await groups_service.update_group_transaction(
            str(current_user.id),
            group_id,
            transaction_id,
            data,
            actor_name=current_user.name,
        )
    except ValueError as e:
        code = str(e)
        if code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        if code == "NOT_AUTHORIZED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_AUTHORIZED",
                    "message": "Only the payer can edit this transaction.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group or transaction not found.",
                "details": {},
            },
        )


@router.delete("/groups/groups/{group_id}/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_transaction(
    group_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a group transaction (only the payer can delete)."""
    try:
        await groups_service.delete_group_transaction(
            str(current_user.id),
            group_id,
            transaction_id,
            actor_name=current_user.name,
        )
    except ValueError as e:
        code = str(e)
        if code == "NOT_A_MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_A_MEMBER",
                    "message": "You are not a member of this group.",
                    "details": {},
                },
            )
        if code == "NOT_AUTHORIZED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "NOT_AUTHORIZED",
                    "message": "Only the payer can delete this transaction.",
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Group or transaction not found.",
                "details": {},
            },
        )


# ===== Balances =====

@router.get("/balances", status_code=status.HTTP_200_OK)
async def get_balances(
    current_user: User = Depends(get_current_user),
) -> BalanceListResponse:
    """Get current user's non-zero balances."""
    return await groups_service.get_balances(str(current_user.id))


@router.get("/balances/{friend_id}", status_code=status.HTTP_200_OK)
async def get_balance_with_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
) -> BalanceResponse:
    """Get balance with a specific friend."""
    return await groups_service.get_balance_with_friend(str(current_user.id), friend_id)
