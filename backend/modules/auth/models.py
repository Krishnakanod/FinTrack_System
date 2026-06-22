"""Auth module - Beanie Document models for User, OTP, and RefreshToken."""

from datetime import datetime
from beanie import Document, Indexed
from typing import Literal


class User(Document):
    """User model for authentication and profile data."""

    email: str = Indexed(unique=True)
    name: str
    password_hash: str
    is_verified: bool = False
    failed_login_attempts: int = 0
    locked_until: datetime | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "users"
        use_state_management = True


class OTP(Document):
    """OTP model for email verification and password reset."""

    email: Indexed(str)
    otp_hash: str
    purpose: Literal["signup", "login", "forgot_password"]
    expires_at: datetime
    created_at: datetime

    class Settings:
        name = "otps"
        indexes = ["expires_at"]  # TTL index managed by MongoDB via expireAfterSeconds


class RefreshToken(Document):
    """Refresh token model for JWT rotation."""

    user_id: Indexed(str)
    token_hash: str
    expires_at: datetime

    class Settings:
        name = "refresh_tokens"
        indexes = ["expires_at"]  # TTL index managed by MongoDB via expireAfterSeconds
