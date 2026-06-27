"""Users module — Pydantic schemas for request/response models.

Locked contract per Spec-06 §1.2.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ===== Profile Schemas =====

class UserProfileResponse(BaseModel):
    """Public profile response (used by GET/PUT /me, search, friend list)."""
    id: str
    email: str
    name: str
    avatar_url: str | None = None


class UpdateProfileRequest(BaseModel):
    """Request body for PUT /api/v1/users/me."""
    name: str | None = None
    avatar_url: str | None = None


# ===== Search Schemas =====

class UserSearchResult(BaseModel):
    """Search result for GET /api/v1/users/search."""
    id: str
    email: str
    name: str
    avatar_url: str | None = None


# ===== Friend Schemas =====

class AddFriendRequest(BaseModel):
    """Request body for POST /api/v1/users/friends."""
    friend_user_id: str = Field(..., min_length=1)


class FriendResponse(BaseModel):
    """Single friend entry in list/search results."""
    id: str
    name: str
    email: str
    avatar_url: str | None = None


class FriendsListResponse(BaseModel):
    """Response body for GET /api/v1/users/friends."""
    items: list[FriendResponse]