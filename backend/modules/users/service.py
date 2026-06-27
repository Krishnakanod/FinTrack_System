"""Users module — Business logic services for profile and friends."""

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from modules.auth.models import User
from modules.users.models import Friendship
from modules.users.schemas import (
    UserProfileResponse,
    UserSearchResult,
    FriendResponse,
)


# ===== Profile =====

async def get_profile(user_id: str) -> Optional[UserProfileResponse]:
    """Get a user's profile (public fields only)."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return None
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
    )


async def update_profile(
    user_id: str, name: Optional[str], avatar_url: Optional[str]
) -> Optional[UserProfileResponse]:
    """Update a user's profile. Returns updated profile or None if not found."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return None

    update_data = {}
    if name is not None:
        user.name = name
        update_data["name"] = name
    if avatar_url is not None:
        user.avatar_url = avatar_url
        update_data["avatar_url"] = avatar_url
    if update_data:
        user.updated_at = datetime.now(timezone.utc)
        await user.save()

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
    )


# ===== User Search =====

async def search_user_by_email(email: str) -> Optional[UserSearchResult]:
    """Search for a verified user by email. Returns None if not found."""
    user = await User.find_one({"email": email, "is_verified": True})
    if not user:
        return None
    return UserSearchResult(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
    )


# ===== Friends =====

async def _get_user_public_info(user_id: str) -> Optional[dict]:
    """Fetch public info for a user (internal helper)."""
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        return None
    if not user:
        return None
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }


def _make_friend_response(user_info: dict) -> FriendResponse:
    """Convert user info dict to FriendResponse."""
    return FriendResponse(
        id=user_info["id"],
        name=user_info["name"],
        email=user_info["email"],
        avatar_url=user_info.get("avatar_url"),
    )


async def add_friend(user_id: str, friend_user_id: str) -> FriendResponse:
    """Add a friend. Creates Friendship with status="accepted" immediately.

    Raises:
        ValueError: CANNOT_ADD_SELF
        ValueError: ALREADY_FRIENDS
        ValueError: NOT_FOUND (friend doesn't exist)
    """
    # Cannot add yourself
    if user_id == friend_user_id:
        raise ValueError("CANNOT_ADD_SELF")

    # Verify friend exists
    friend_info = await _get_user_public_info(friend_user_id)
    if not friend_info:
        raise ValueError("NOT_FOUND")

    # Check both directions for existing friendship
    existing = await Friendship.find_one({
        "$or": [
            {"requester_id": user_id, "addressee_id": friend_user_id},
            {"requester_id": friend_user_id, "addressee_id": user_id},
        ]
    })
    if existing:
        raise ValueError("ALREADY_FRIENDS")

    # Create friendship
    try:
        friendship = Friendship(
            requester_id=user_id,
            addressee_id=friend_user_id,
            status="accepted",
            created_at=datetime.now(timezone.utc),
        )
        await friendship.insert()
    except DuplicateKeyError:
        # Race condition: another request created it between check and insert
        raise ValueError("ALREADY_FRIENDS")

    return _make_friend_response(friend_info)


async def list_friends(user_id: str) -> list[FriendResponse]:
    """List all friends for a user. Checks both edges of the friendship.

    Locked: returns alphabetically sorted by name (Spec-06 §1.2).
    """
    friendships = await Friendship.find({
        "$or": [
            {"requester_id": user_id},
            {"addressee_id": user_id},
        ]
    }).to_list()

    friend_ids = []
    for f in friendships:
        if f.requester_id == user_id:
            friend_ids.append(f.addressee_id)
        else:
            friend_ids.append(f.requester_id)

    if not friend_ids:
        return []

    # Fetch user info for all friends
    friends = []
    for fid in friend_ids:
        try:
            user_info = await _get_user_public_info(fid)
            if user_info:
                friends.append(_make_friend_response(user_info))
        except Exception:
            continue

    # Sort alphabetically by name (locked requirement)
    friends.sort(key=lambda f: f.name.lower())
    return friends


async def remove_friend(user_id: str, friend_id: str) -> bool:
    """Remove a friendship. Deletes the document regardless of direction.
    Returns True if deleted, False if not found.
    """
    result = await Friendship.find_one({
        "$or": [
            {"requester_id": user_id, "addressee_id": friend_id},
            {"requester_id": friend_id, "addressee_id": user_id},
        ]
    })

    if not result:
        return False

    await result.delete()
    return True