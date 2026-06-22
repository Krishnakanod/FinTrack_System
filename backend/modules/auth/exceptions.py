"""Custom exception classes for authentication."""

from datetime import datetime
from fastapi import HTTPException, status


class AppException(Exception):
    """Base exception class for FinTrack."""

    error_code: str = "APP_ERROR"
    message: str = "An application error occurred."
    details: dict = {}

    def to_http_exception(self) -> HTTPException:
        """Convert this exception to a FastAPI HTTPException."""
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": self.error_code,
                "message": self.message,
                "details": self.details or {},
            },
        )


# ===== Auth-specific exceptions =====

class EmailAlreadyExistsError(AppException):
    """Raised when email already exists in system."""

    error_code = "EMAIL_ALREADY_EXISTS"
    message = "An account with this email already exists."
    details: dict = {}


class InvalidOtpError(AppException):
    """Raised when OTP is incorrect."""

    error_code = "INVALID_OTP"
    message = "The OTP is incorrect or has expired."
    details: dict = {}


class OtpExpiredError(InvalidOtpError):
    """Raised when OTP has expired (subclass for semantic clarity)."""

    pass


class InvalidCredentialsError(HTTPException):
    """Raised when email/password credentials are invalid."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
                "details": {},
            },
        )


class AccountLockedError(HTTPException):
    """Raised when user account is locked due to too many failed attempts."""

    def __init__(self, locked_until: datetime):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCOUNT_LOCKED",
                "message": "Too many failed attempts. Try again in 5 minutes.",
                "details": {"locked_until": locked_until.isoformat()},
            },
        )


class AccountNotVerifiedError(HTTPException):
    """Raised when trying to login with an unverified account."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCOUNT_NOT_VERIFIED",
                "message": "Please verify your email before logging in.",
                "details": {},
            },
        )


class InvalidRefreshTokenError(HTTPException):
    """Raised when refresh token is missing, expired, or invalid."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_REFRESH_TOKEN",
                "message": "Session expired. Please log in again.",
                "details": {},
            },
        )


class PasswordMismatchError(HTTPException):
    """Raised when passwords do not match during signup/reset."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "PASSWORD_MISMATCH",
                "message": "Passwords do not match.",
                "details": {},
            },
        )
