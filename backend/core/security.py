"""Security utilities for authentication - password hashing, JWT, OTP."""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from passlib.context import CryptContext
from jose import jwt, JWTError, ExpiredSignatureError

from core.config import settings


# Password hashing context (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str) -> str:
    """Create a JWT access token with 15-minute TTL."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_ttl_minutes)
    to_encode: dict[str, Any] = {
        "sub": user_id,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token with 7-day TTL."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_ttl_days)
    to_encode: dict[str, Any] = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token string
        expected_type: Either "access" or "refresh" - validates the token type matches

    Returns:
        The decoded payload dict containing sub, type, exp, iat

    Raises:
        JWTError: If token is invalid, expired, or wrong type
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        token_type = payload.get("type")
        if token_type != expected_type:
            raise JWTError(f"Token type mismatch: expected {expected_type}, got {token_type}")
        return payload
    except ExpiredSignatureError:
        raise JWTError("Token has expired")
    except JWTError as e:
        raise JWTError(f"Invalid token: {str(e)}")


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return str(secrets.randbelow(1000000)).zfill(6)


def hash_otp(otp: str) -> str:
    """Hash an OTP using bcrypt for secure storage."""
    return pwd_context.hash(otp)


def verify_otp_hash(otp: str, hashed_otp: str) -> bool:
    """Verify an OTP against its hash."""
    return pwd_context.verify(otp, hashed_otp)


def hash_otp_simple(otp: str) -> str:
    """Alternative: Hash OTP using SHA-256 (faster than bcrypt, acceptable for short-lived OTPs)."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp_hash_simple(otp: str, hashed_otp: str) -> bool:
    """Verify OTP against SHA-256 hash."""
    return hashlib.sha256(otp.encode()).hexdigest() == hashed_otp
