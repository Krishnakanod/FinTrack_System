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
        avatar_url=data.avatar_url,
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
    """Add a friend by user ID.

    Locked errors:
    - 400 CANNOT_ADD_SELF
    - 409 ALREADY_FRIENDS
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
        elif error_code == "ALREADY_FRIENDS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "ALREADY_FRIENDS",
                    "message": "You are already friends with this user.",
                    "details": {},
                },
            )
        elif error_code == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "User not found.",
                    "details": {},
                },
            )


@router.get("/friends", status_code=status.HTTP_200_OK)
async def list_friends(
    current_user: User = Depends(get_current_user),
) -> FriendsListResponse:
    """List all friends. Returns alphabetically sorted by name (locked)."""
    friends = await users_service.list_friends(str(current_user.id))
    return FriendsListResponse(items=friends)


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