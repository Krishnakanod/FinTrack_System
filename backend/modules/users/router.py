"""Users module — FastAPI routers and endpoints.

Locked contracts per Spec-06 §1.2.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.deps import get_current_user
from modules.auth.models import User
from modules.users.schemas import (
    UserProfileResponse,
    UpdateProfileRequest,
    UserSearchResult,
    AddFriendRequest,
    FriendResponse,
    FriendsListResponse,
    FriendRequestsListResponse,
    NotificationPreferencesResponse,
    UpdateNotificationPreferencesRequest,
)
from modules.users import service as users_service


router = APIRouter(prefix="/api/v1/users", tags=["users"])


# ===== Profile Endpoints =====

@router.get("/me", status_code=status.HTTP_200_OK)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Get own profile."""
    profile = await users_service.get_profile(str(current_user.id))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "User profile not found.",
                "details": {},
            },
        )
    return profile


@router.put("/me", status_code=status.HTTP_200_OK)
async def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Update own profile. Only name and avatar_url are editable."""
    profile = await users_service.update_profile(
        user_id=str(current_user.id),
        name=data.name,
        username=data.username,
        avatar_url=data.avatar_url,
        upi_id=data.upi_id,
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "User not found.",
                "details": {},
            },
        )
    return profile


# ===== Search Endpoint =====

@router.get("/search", status_code=status.HTTP_200_OK)
async def search_user(
    email: str = Query(..., description="Email to search for"),
    current_user: User = Depends(get_current_user),
) -> UserSearchResult | None:
    """Search for a verified user by email.

    Locked: returns 200 with null body for "not found" (not 404).
    """
    result = await users_service.search_user_by_email(email)
    if not result:
        return None
    return result


# ===== Friends Endpoints =====

@router.post("/friends", status_code=status.HTTP_201_CREATED)
async def add_friend(
    data: AddFriendRequest,
    current_user: User = Depends(get_current_user),
) -> FriendResponse:
    """Send a friend request.

    Locked errors:
    - 400 CANNOT_ADD_SELF
    - 409 ALREADY_FRIENDS / PENDING_REQUEST / INCOMING_REQUEST
    - 404 NOT_FOUND (friend doesn't exist)
    """
    try:
        return await users_service.add_friend(
            user_id=str(current_user.id),
            friend_user_id=data.friend_user_id,
        )
    except ValueError as e:
        error_code = str(e)
        if error_code == "CANNOT_ADD_SELF":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "CANNOT_ADD_SELF",
                    "message": "You cannot add yourself as a friend.",
                    "details": {},
                },
            )
        if error_code == "ALREADY_FRIENDS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "ALREADY_FRIENDS",
                    "message": "You are already friends with this user.",
                    "details": {},
                },
            )
        if error_code == "PENDING_REQUEST":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "PENDING_REQUEST",
                    "message": "A friend request is already pending.",
                    "details": {},
                },
            )
        if error_code == "INCOMING_REQUEST":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "INCOMING_REQUEST",
                    "message": "This user has already sent you a friend request.",
                    "details": {},
                },
            )
        if error_code == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "User not found.",
                    "details": {},
                },
            )
        raise


@router.get("/friends", status_code=status.HTTP_200_OK)
async def list_friends(
    current_user: User = Depends(get_current_user),
) -> FriendsListResponse:
    """List all accepted friends. Returns alphabetically sorted by name (locked)."""
    friends = await users_service.list_friends(str(current_user.id))
    return FriendsListResponse(items=friends)


@router.get("/friends/requests", status_code=status.HTTP_200_OK)
async def list_friend_requests(
    request_type: str = Query(..., alias="type"),
    current_user: User = Depends(get_current_user),
) -> FriendRequestsListResponse:
    """List incoming or outgoing friend requests."""
    if request_type not in ("incoming", "outgoing"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "INVALID_TYPE",
                "message": "type must be 'incoming' or 'outgoing'.",
                "details": {},
            },
        )
    try:
        items = await users_service.list_friend_requests(
            str(current_user.id), request_type
        )
        return FriendRequestsListResponse(items=items)
    except ValueError as e:
        if str(e) == "INVALID_TYPE":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "INVALID_TYPE",
                    "message": "type must be 'incoming' or 'outgoing'.",
                    "details": {},
            },
        )
        raise


@router.post("/friends/requests/{request_id}/accept", status_code=status.HTTP_200_OK)
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
) -> FriendResponse:
    """Accept an incoming friend request."""
    try:
        return await users_service.accept_friend_request(
            str(current_user.id), request_id
        )
    except ValueError as e:
        if str(e) == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "Friend request not found.",
                    "details": {},
                },
            )
        raise


@router.post("/friends/requests/{request_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Reject an incoming friend request."""
    try:
        await users_service.reject_friend_request(str(current_user.id), request_id)
    except ValueError as e:
        if str(e) == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "Friend request not found.",
                    "details": {},
                },
            )
        raise


@router.post("/friends/requests/{request_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel an outgoing friend request."""
    try:
        await users_service.cancel_friend_request(str(current_user.id), request_id)
    except ValueError as e:
        if str(e) == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "Friend request not found.",
                    "details": {},
                },
            )
        raise


@router.delete("/friends/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a friendship regardless of direction."""
    deleted = await users_service.remove_friend(
        user_id=str(current_user.id),
        friend_id=friend_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Friendship not found.",
                "details": {},
            },
        )


# ===== Notification Preferences Endpoints =====

@router.get("/me/notification-preferences", status_code=status.HTTP_200_OK)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
) -> NotificationPreferencesResponse:
    """Get the current user's notification opt-in preferences."""
    try:
        return await users_service.get_notification_preferences(str(current_user.id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "NOT_FOUND", "message": "User not found.", "details": {}},
        )


@router.put("/me/notification-preferences", status_code=status.HTTP_200_OK)
async def update_notification_preferences(
    data: UpdateNotificationPreferencesRequest,
    current_user: User = Depends(get_current_user),
) -> NotificationPreferencesResponse:
    """Update the current user's notification preferences (PATCH semantics — only provided fields are changed)."""
    try:
        return await users_service.update_notification_preferences(
            user_id=str(current_user.id),
            friends=data.friends,
            groups=data.groups,
            budget=data.budget,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "NOT_FOUND", "message": "User not found.", "details": {}},
        )
