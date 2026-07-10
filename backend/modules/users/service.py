"""Users module — Business logic services for profile and friends."""

from datetime import datetime, timezone
from typing import Optional
import os
import time
from fastapi import UploadFile

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
    NotificationPreferencesResponse,
)
from modules.websocket.manager import connection_manager
from modules.notifications.service import create_notification


def _friend_event(action: str, actor_id: str, target_id: str) -> dict:
    """Build a FRIEND_EVENT WebSocket payload."""
    return {
        "type": "FRIEND_EVENT",
        "payload": {
            "action": action,
            "actor_id": actor_id,
            "target_id": target_id,
        },
    }


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
        upi_id=user.upi_id,
    )


async def update_profile(
    user_id: str, name: Optional[str], username: Optional[str], avatar_url: Optional[str], upi_id: Optional[str] = None
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
    if upi_id is not None:
        user.upi_id = upi_id
        update_data["upi_id"] = upi_id
    if update_data:
        user.updated_at = datetime.now(timezone.utc)
        await user.save()

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        name=user.name,
        avatar_url=user.avatar_url,
        upi_id=user.upi_id,
    )


async def upload_avatar(user_id: str, file: UploadFile, request_url: str) -> Optional[UserProfileResponse]:
    """Upload a user's avatar image."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return None

    uploads_dir = "uploads"
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    filename = f"user_{user_id}_{int(time.time())}.{ext}"
    filepath = os.path.join(uploads_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    from urllib.parse import urlparse
    parsed = urlparse(request_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    avatar_url = f"{base_url}/uploads/{filename}"

    user.avatar_url = avatar_url
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        name=user.name,
        avatar_url=user.avatar_url,
        upi_id=user.upi_id,
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
        upi_id=user.upi_id,
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
        "upi_id": user.upi_id,
    }


def _make_friend_response(user_info: dict) -> FriendResponse:
    """Convert user info dict to FriendResponse."""
    return FriendResponse(
        id=user_info["id"],
        name=user_info["name"],
        email=user_info["email"],
        avatar_url=user_info.get("avatar_url"),
        upi_id=user_info.get("upi_id"),
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
        event = _friend_event("request_sent", actor_id=user_id, target_id=friend_user_id)
        await connection_manager.broadcast([friend_user_id, user_id], event)

        actor_info = await _get_user_public_info(user_id)
        actor_name = actor_info["name"] if actor_info else "Someone"
        await create_notification(
            user_id=friend_user_id,
            type="friend_request",
            title="New Friend Request",
            body=f"{actor_name} sent you a friend request.",
            metadata={"actor_id": user_id},
            category="friends",
        )

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

    # Notify the target user that a request arrived,
    # and the actor that their outgoing list changed.
    event = _friend_event("request_sent", actor_id=user_id, target_id=friend_user_id)
    await connection_manager.broadcast([friend_user_id, user_id], event)

    actor_info = await _get_user_public_info(user_id)
    actor_name = actor_info["name"] if actor_info else "Someone"
    await create_notification(
        user_id=friend_user_id,
        type="friend_request",
        title="New Friend Request",
        body=f"{actor_name} sent you a friend request.",
        metadata={"actor_id": user_id},
        category="friends",
    )

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

    # Notify original requester that their request was accepted.
    event = _friend_event("request_accepted", actor_id=user_id, target_id=friendship.requester_id)
    await connection_manager.broadcast([friendship.requester_id, user_id], event)

    actor_info = await _get_user_public_info(user_id)
    actor_name = actor_info["name"] if actor_info else "Someone"
    await create_notification(
        user_id=friendship.requester_id,
        type="friend_request",
        title="Friend Request Accepted",
        body=f"{actor_name} accepted your friend request.",
        metadata={"actor_id": user_id},
        category="friends",
    )

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

    # Notify requester their outgoing request was rejected.
    event = _friend_event("request_rejected", actor_id=user_id, target_id=friendship.requester_id)
    await connection_manager.broadcast([friendship.requester_id, user_id], event)


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

    # Notify the addressee their incoming request was cancelled.
    event = _friend_event("request_cancelled", actor_id=user_id, target_id=friendship.addressee_id)
    await connection_manager.broadcast([friendship.addressee_id, user_id], event)


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

    # Notify the other user they were removed from someone's friends list.
    event = _friend_event("friend_removed", actor_id=user_id, target_id=friend_id)
    await connection_manager.broadcast([friend_id, user_id], event)

    actor_info = await _get_user_public_info(user_id)
    actor_name = actor_info["name"] if actor_info else "Someone"
    await create_notification(
        user_id=friend_id,
        type="friend_request",
        title="Removed from Friends",
        body=f"{actor_name} removed you from their friends list.",
        metadata={"actor_id": user_id},
        category="friends",
    )

    return True


# ===== Notification Preferences =====

async def get_notification_preferences(user_id: str) -> NotificationPreferencesResponse:
    """Return the current user's notification opt-in preferences."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise ValueError("NOT_FOUND")
    prefs = user.notification_preferences
    return NotificationPreferencesResponse(
        friends=prefs.friends,
        groups=prefs.groups,
        budget=prefs.budget,
    )


async def update_notification_preferences(
    user_id: str,
    friends: bool | None,
    groups: bool | None,
    budget: bool | None,
) -> NotificationPreferencesResponse:
    """Update the current user's notification opt-in preferences (PATCH semantics).
    Only fields that are not None are updated.
    """
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise ValueError("NOT_FOUND")

    if friends is not None:
        user.notification_preferences.friends = friends
    if groups is not None:
        user.notification_preferences.groups = groups
    if budget is not None:
        user.notification_preferences.budget = budget

    await user.save()

    prefs = user.notification_preferences
    return NotificationPreferencesResponse(
        friends=prefs.friends,
        groups=prefs.groups,
        budget=prefs.budget,
    )
