"""Pydantic schemas for authentication requests and responses."""

import re
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional


# ===== Request Schemas =====

class SignupRequest(BaseModel):
    """Request body for user signup."""

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def validate_password(self):
        """Validate password complexity and confirm_password match."""
        # Check confirm_password matches
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")

        # Check at least one letter and one number
        if not re.search(r"[a-zA-Z]", self.password):
            raise ValueError("Password must contain at least one letter.")
        if not re.search(r"[0-9]", self.password):
            raise ValueError("Password must contain at least one number.")

        return self


class VerifyOtpRequest(BaseModel):
    """Request body for OTP verification."""

    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: str = "signup"


class LoginRequest(BaseModel):
    """Request body for user login."""

    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    """Request body for forgot password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request body for reset password."""

    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
    confirm_new_password: str

    @model_validator(mode="after")
    def validate_reset_password(self):
        """Validate password complexity and confirm password match."""
        # Check confirm_new_password matches
        if self.new_password != self.confirm_new_password:
            raise ValueError("Passwords do not match.")

        # Check at least one letter and one number
        if not re.search(r"[a-zA-Z]", self.new_password):
            raise ValueError("Password must contain at least one letter.")
        if not re.search(r"[0-9]", self.new_password):
            raise ValueError("Password must contain at least one number.")

        return self


# ===== Response Schemas =====

class TokenResponse(BaseModel):
    """JWT token response (access + refresh)."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User profile response (excludes sensitive fields)."""

    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None


class OtpSentResponse(BaseModel):
    """Generic response for OTP sent."""

    message: str


class PasswordResetResponse(BaseModel):
    """Response after successful password reset."""

    message: str = "Password reset successfully"


class LogoutResponse(BaseModel):
    """Response after successful logout."""

    message: str = "Logged out successfully"