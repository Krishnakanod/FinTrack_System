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
    FriendRequestResponse,
    FriendRequestsListResponse,
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
        username=user.username,
        name=user.name,
        avatar_url=user.avatar_url,
    )


async def update_profile(
    user_id: str, name: Optional[str], username: Optional[str], avatar_url: Optional[str]
) -> Optional[UserProfileResponse]:
    """Update a user's profile. Returns updated profile or None if not found."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return None

    update_data = {}
    if name is not None:
        user.name = name
        update_data["name"] = name
    if username is not None:
        user.username = username
        update_data["username"] = username
    if avatar_url is not None:
        user.avatar_url = avatar_url
        update_data["avatar_url"] = avatar_url
    if update_data:
        user.updated_at = datetime.now(timezone.utc)
        await user.save()

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
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


# ===== Friends (with request/approval flow) =====

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


async def _get_friendship(user_id: str, other_id: str) -> Friendship | None:
    """Return any friendship document between two users, regardless of direction."""
    return await Friendship.find_one({
        "$or": [
            {"requester_id": user_id, "addressee_id": other_id},
            {"requester_id": other_id, "addressee_id": user_id},
        ]
    })


async def add_friend(user_id: str, friend_user_id: str) -> FriendResponse:
    """Send a friend request. Creates Friendship with status='pending'.

    Raises:
        ValueError: CANNOT_ADD_SELF
        ValueError: ALREADY_FRIENDS or PENDING_REQUEST
        ValueError: NOT_FOUND (friend doesn't exist)
    """
    if user_id == friend_user_id:
        raise ValueError("CANNOT_ADD_SELF")

    friend_info = await _get_user_public_info(friend_user_id)
    if not friend_info:
        raise ValueError("NOT_FOUND")

    existing = await _get_friendship(user_id, friend_user_id)
    if existing:
        if existing.status == "accepted":
            raise ValueError("ALREADY_FRIENDS")
        if existing.status == "pending":
            if existing.requester_id == user_id:
                raise ValueError("PENDING_REQUEST")
            raise ValueError("INCOMING_REQUEST")
        # rejected / cancelled can be re-requested; fall through
        existing.requester_id = user_id
        existing.addressee_id = friend_user_id
        existing.status = "pending"
        existing.updated_at = datetime.now(timezone.utc)
        await existing.save()
        return _make_friend_response(friend_info)

    try:
        friendship = Friendship(
            requester_id=user_id,
            addressee_id=friend_user_id,
            status="pending",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await friendship.insert()
    except DuplicateKeyError:
        raise ValueError("PENDING_REQUEST")

    return _make_friend_response(friend_info)


async def list_friends(user_id: str) -> list[FriendResponse]:
    """List all accepted friends for a user."""
    friendships = await Friendship.find({
        "$or": [
            {"requester_id": user_id},
            {"addressee_id": user_id},
        ],
        "status": "accepted",
    }).to_list()

    friend_ids = []
    for f in friendships:
        if f.requester_id == user_id:
            friend_ids.append(f.addressee_id)
        else:
            friend_ids.append(f.requester_id)

    if not friend_ids:
        return []

    friends = []
    for fid in friend_ids:
        try:
            user_info = await _get_user_public_info(fid)
            if user_info:
                friends.append(_make_friend_response(user_info))
        except Exception:
            continue

    friends.sort(key=lambda f: f.name.lower())
    return friends


async def list_friend_requests(
    user_id: str, request_type: str
) -> list[FriendRequestResponse]:
    """List incoming or outgoing friend requests for a user."""
    if request_type == "incoming":
        query = {"addressee_id": user_id, "status": "pending"}
    elif request_type == "outgoing":
        query = {"requester_id": user_id, "status": "pending"}
    else:
        raise ValueError("INVALID_TYPE")

    friendships = await Friendship.find(query).to_list()
    responses = []

    for f in friendships:
        if request_type == "incoming":
            sender = await _get_user_public_info(f.requester_id)
            if not sender:
                continue
            responses.append(
                FriendRequestResponse(
                    id=str(f.id),
                    sender_id=f.requester_id,
                    receiver_id=f.addressee_id,
                    sender_name=sender["name"],
                    sender_email=sender["email"],
                    status=f.status,
                    created_at=f.created_at.isoformat(),
                )
            )
        else:
            receiver = await _get_user_public_info(f.addressee_id)
            if not receiver:
                continue
            responses.append(
                FriendRequestResponse(
                    id=str(f.id),
                    sender_id=f.requester_id,
                    receiver_id=f.addressee_id,
                    sender_name=receiver["name"],
                    sender_email=receiver["email"],
                    status=f.status,
                    created_at=f.created_at.isoformat(),
                )
            )

    return responses


async def accept_friend_request(user_id: str, request_id: str) -> FriendResponse:
    """Accept an incoming friend request."""
    try:
        friendship = await Friendship.get(PydanticObjectId(request_id))
    except Exception:
        friendship = None

    if not friendship or friendship.status != "pending" or friendship.addressee_id != user_id:
        raise ValueError("NOT_FOUND")

    friendship.status = "accepted"
    friendship.updated_at = datetime.now(timezone.utc)
    await friendship.save()

    friend_info = await _get_user_public_info(friendship.requester_id)
    return _make_friend_response(friend_info) if friend_info else None


async def reject_friend_request(user_id: str, request_id: str) -> None:
    """Reject an incoming friend request."""
    try:
        friendship = await Friendship.get(PydanticObjectId(request_id))
    except Exception:
        friendship = None

    if not friendship or friendship.status != "pending" or friendship.addressee_id != user_id:
        raise ValueError("NOT_FOUND")

    friendship.status = "rejected"
    friendship.updated_at = datetime.now(timezone.utc)
    await friendship.save()


async def cancel_friend_request(user_id: str, request_id: str) -> None:
    """Cancel an outgoing friend request."""
    try:
        friendship = await Friendship.get(PydanticObjectId(request_id))
    except Exception:
        friendship = None

    if not friendship or friendship.status != "pending" or friendship.requester_id != user_id:
        raise ValueError("NOT_FOUND")

    friendship.status = "cancelled"
    friendship.updated_at = datetime.now(timezone.utc)
    await friendship.save()


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
