"""Auth module - FastAPI routers and endpoints."""

from fastapi import APIRouter, HTTPException, status, Cookie, Depends
from fastapi.responses import JSONResponse

from modules.auth.schemas import (
    SignupRequest,
    VerifyOtpRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from modules.auth import service as auth_service
from modules.auth.exceptions import (
    EmailAlreadyExistsError,
    InvalidOtpError,
    InvalidCredentialsError,
    AccountLockedError,
    AccountNotVerifiedError,
    PasswordMismatchError,
)
from core.security import decode_token, hash_otp_simple, create_access_token
from core.deps import get_current_user
from modules.auth.models import RefreshToken


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ===== SIGNUP =====

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    """
    Register a new user. Sends OTP to email for verification.

    If email already has a verified account → 409 Conflict.
    If email has an unverified account → allows re-signup (updates password + sends new OTP).
    """
    try:
        message = await auth_service.signup(request)
        return {"message": message}
    except EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "EMAIL_ALREADY_EXISTS",
                "message": "An account with this email already exists.",
                "details": {},
            },
        )


# ===== VERIFY OTP =====

@router.post("/verify-otp", status_code=status.HTTP_200_OK)
async def verify_otp(request: VerifyOtpRequest):
    """
    Verify OTP and complete signup flow.

    On success: issues access_token + refresh_token cookie, returns user profile.
    """
    try:
        token_response, user_response, raw_refresh_token = await auth_service.verify_otp(request)
    except InvalidOtpError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_OTP",
                "message": "The OTP is incorrect or has expired.",
                "details": {},
            },
        )

    # Use the tokens issued by the service (which also stored the refresh token hash)
    response = JSONResponse(
        content={
            "access_token": token_response["access_token"],
            "token_type": "bearer",
            "user": user_response,
        }
    )
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        path="/api/v1/auth",
        samesite="lax",
        secure=False,  # Will be True in production over HTTPS
        max_age=7 * 24 * 60 * 60,  # 7 days in seconds
    )

    return response


# ===== LOGIN =====

@router.post("/login", status_code=status.HTTP_200_OK)
async def login(request: LoginRequest):
    """
    Login with email/password. Issues JWT access token and refresh_token cookie.

    Handles lockout after 3 failed attempts (5-minute cooldown).
    """
    try:
        token_response, user_response, raw_refresh_token = await auth_service.login(request)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
                "details": {},
            },
        )
    except AccountLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.detail,
        )
    except AccountNotVerifiedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "ACCOUNT_NOT_VERIFIED",
                "message": "Please verify your email before logging in.",
                "details": {},
            },
        )

    # Use the tokens issued by the service (which also stored the refresh token hash)
    response = JSONResponse(
        content={
            "access_token": token_response["access_token"],
            "token_type": "bearer",
            "user": user_response,
        }
    )
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        path="/api/v1/auth",
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 60 * 60,
    )

    return response


# ===== FORGOT PASSWORD =====

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset OTP.

    Anti-enumeration: Same response whether user exists or not.
    """
    message = await auth_service.forgot_password(request)
    return {"message": message}


# ===== RESET PASSWORD =====

@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using OTP verification.
    """
    try:
        message = await auth_service.reset_password(request)
        return {"message": message}
    except InvalidOtpError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_OTP",
                "message": "The OTP is incorrect or has expired.",
                "details": {},
            },
        )


# ===== REFRESH TOKEN =====

@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(refresh_token: str = Cookie(...)):
    """
    Refresh access token using valid refresh token from httpOnly cookie.

    Returns new access token; refresh token remains valid until expiry.
    """
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")

        if not user_id:
            raise ValueError("No user_id in token")

        # Verify refresh token exists in database
        rt_record = await RefreshToken.find_one(
            RefreshToken.user_id == user_id,
            RefreshToken.token_hash == hash_otp_simple(refresh_token),
        )

        if not rt_record:
            raise ValueError("Token not found in database")

        # Issue new access token
        new_access_token = create_access_token(user_id)

        return {"access_token": new_access_token, "token_type": "bearer"}

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_REFRESH_TOKEN",
                "message": "Session expired. Please log in again.",
                "details": {},
            },
        )


# ===== LOGOUT =====

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    refresh_token: str = Cookie(...),
):
    """
    Logout user by invalidating refresh token.

    Clears the refresh_token cookie.
    """
    # Delete refresh token from database
    await auth_service.logout(refresh_token)

    # Return success and clear cookie
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
    )

    return response


# ===== PROTECTED PROFILE (dummy, for verifying get_current_user works) =====

@router.get("/me", status_code=status.HTTP_200_OK)
async def get_me(user=Depends(get_current_user)):
    """
    Protected endpoint that returns the current user's profile.

    This acts as the de-facto proof that JWT auth works.
    Sprint 6 will move this to /api/v1/users/me.
    """
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }