"""Auth module - Business logic services."""

from datetime import datetime, timedelta, timezone

from modules.auth.models import User, OTP, RefreshToken
from modules.auth.schemas import (
    SignupRequest,
    VerifyOtpRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from modules.auth.exceptions import (
    EmailAlreadyExistsError,
    InvalidOtpError,
    InvalidCredentialsError,
    AccountLockedError,
    AccountNotVerifiedError,
    PasswordMismatchError,
)
from core import security
from core.email import send_email, create_otp_email_body


# ===== SIGNUP =====

async def signup(data: SignupRequest) -> str:
    """
    Register a new user, generate and email OTP.

    Behavior for unverified existing user:
    - If a User exists with is_verified=False, allow re-signup:
      * Update password_hash with new hash
      * Regenerate and email fresh OTP
      * Update updated_at timestamp
    - Only verified users block re-signup (409 Conflict)

    Returns:
        Message string confirming OTP sent

    Raises:
        EmailAlreadyExistsError: If email already has a verified account
    """
    email_normalized = data.email.lower().strip()

    # Check if email already has a verified account
    existing_user = await User.find_one(User.email == email_normalized)

    if existing_user and existing_user.is_verified:
        raise EmailAlreadyExistsError()

    # Hash password and generate OTP
    password_hash = security.hash_password(data.password)
    otp = security.generate_otp()
    otp_hash = security.hash_otp(otp)

    now_utc = datetime.now(timezone.utc)

    if existing_user:
        # Re-attempt signup on unverified user: update credentials
        existing_user.password_hash = password_hash
        existing_user.updated_at = now_utc
        await existing_user.save()

        # Delete old OTP for this email+purpose
        await OTP.find(
            OTP.email == email_normalized,
            OTP.purpose == "signup",
        ).delete()
    else:
        # Create new user
        user = await User(
            email=email_normalized,
            name=data.name,
            password_hash=password_hash,
            is_verified=False,
            avatar_url=None,
            failed_login_attempts=0,
            locked_until=None,
            created_at=now_utc,
            updated_at=now_utc,
        ).insert()

    # Create OTP document with 10-min TTL
    await OTP(
        email=email_normalized,
        otp_hash=otp_hash,
        purpose="signup",
        expires_at=now_utc + timedelta(minutes=10),
        created_at=now_utc,
    ).insert()

    # Send OTP email
    subject, body_html = create_otp_email_body(otp, "signup")
    await send_email(data.email, subject, body_html)

    return "OTP sent to your email"


# ===== VERIFY OTP =====

async def verify_otp(data: VerifyOtpRequest) -> tuple[dict, dict, str]:
    """
    Verify OTP and complete signup or login flow.

    Args:
        data: Contains email, otp, and optional purpose ("signup" or "login")

    Returns:
        Tuple of (token_response, user_response, raw_refresh_token)

    Raises:
        InvalidOtpError: If OTP is incorrect or expired
    """
    purpose = data.purpose if data.purpose in ["signup", "login"] else "signup"
    email_normalized = data.email.lower().strip()

    # Find OTP by email and purpose
    otp_record = await OTP.find_one(
        OTP.email == email_normalized,
        OTP.purpose == purpose,
    )

    if not otp_record:
        raise InvalidOtpError()

    # Check expiry
    if datetime.now(timezone.utc) > otp_record.expires_at:
        await otp_record.delete()
        raise InvalidOtpError()

    # Verify OTP hash
    if not security.verify_otp_hash(data.otp, otp_record.otp_hash):
        raise InvalidOtpError()

    # Fetch user
    user = await User.find_one(User.email == email_normalized)
    if not user:
        raise InvalidOtpError()

    # For signup: set is_verified=True, delete OTP, issue tokens
    if purpose == "signup":
        user.is_verified = True
        await user.save(update_fields=["is_verified"])
        await otp_record.delete()
    elif purpose == "login":
        # For login: just clear the OTP and reset failed attempts
        user.failed_login_attempts = 0
        user.locked_until = None
        await user.save(update_fields=["failed_login_attempts", "locked_until"])
        await otp_record.delete()

    # Issue tokens
    access_token = security.create_access_token(str(user.id))
    refresh_token = security.create_refresh_token(str(user.id))

    # Store refresh token hash
    await RefreshToken(
        user_id=str(user.id),
        token_hash=security.hash_otp_simple(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    ).insert()

    # Build responses
    token_response = {
        "access_token": access_token,
        "token_type": "bearer",
    }

    user_response = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }

    # Return raw refresh_token so the router can set it as an httpOnly cookie
    return token_response, user_response, refresh_token


# ===== LOGIN =====

async def login(data: LoginRequest) -> tuple[dict, dict, str]:
    """
    Login user with email/password verification.

    Lockout behavior:
    - After 3 consecutive failed attempts: set locked_until = now + 5 min
    - While locked, return 403 ACCOUNT_LOCKED even with correct password
    - Successful login resets failed_login_attempts to 0

    Returns:
        Tuple of (token_response, user_response, raw_refresh_token)

    Raises:
        InvalidCredentialsError: Wrong email/password
        AccountLockedError: Too many failed attempts (until lockout expires)
        AccountNotVerifiedError: User hasn't verified email yet
    """
    email_normalized = data.email.lower().strip()

    # Fetch user
    user = await User.find_one(User.email == email_normalized)
    if not user:
        raise InvalidCredentialsError()

    # Check if account is locked
    now_utc = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now_utc:
        raise AccountLockedError(user.locked_until)

    # Verify password
    if not security.verify_password(data.password, user.password_hash):
        # Increment failed attempts
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= 3:
            user.locked_until = now_utc + timedelta(minutes=5)
            # Reset counter after setting lock (lockout already set, next attempt post-lockout starts fresh)
            user.failed_login_attempts = 0

        await user.save(update_fields=["failed_login_attempts", "locked_until"])
        raise InvalidCredentialsError()

    # Check if verified
    if not user.is_verified:
        raise AccountNotVerifiedError()

    # Successful login: reset failed attempts, issue tokens
    user.failed_login_attempts = 0
    user.locked_until = None
    await user.save(update_fields=["failed_login_attempts", "locked_until"])

    # Issue tokens
    access_token = security.create_access_token(str(user.id))
    refresh_token = security.create_refresh_token(str(user.id))

    # Store refresh token hash
    await RefreshToken(
        user_id=str(user.id),
        token_hash=security.hash_otp_simple(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    ).insert()

    # Build responses
    token_response = {
        "access_token": access_token,
        "token_type": "bearer",
    }

    user_response = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }

    return token_response, user_response, refresh_token


# ===== FORGOT PASSWORD =====

async def forgot_password(data: ForgotPasswordRequest) -> str:
    """
    Request password reset OTP.

    Anti-enumeration: Always returns same response whether user exists or not.
    No OTP is created/sent if email doesn't exist.

    Returns:
        Generic message regardless of user existence
    """
    email_normalized = data.email.lower().strip()

    # Check if user exists (without revealing existence)
    user = await User.find_one(User.email == email_normalized)
    if not user:
        # Return success but don't send anything (anti-enumeration)
        return "If an account exists with this email, an OTP has been sent."

    # Generate and store OTP for password reset
    otp = security.generate_otp()
    otp_hash = security.hash_otp(otp)
    now_utc = datetime.now(timezone.utc)

    # Delete any existing OTP for forgot_password purpose
    await OTP.find(
        OTP.email == email_normalized,
        OTP.purpose == "forgot_password",
    ).delete()

    # Create new OTP
    await OTP(
        email=email_normalized,
        otp_hash=otp_hash,
        purpose="forgot_password",
        expires_at=now_utc + timedelta(minutes=10),
        created_at=now_utc,
    ).insert()

    # Send OTP email
    subject, body_html = create_otp_email_body(otp, "forgot_password")
    await send_email(data.email, subject, body_html)

    return "If an account exists with this email, an OTP has been sent."


# ===== RESET PASSWORD =====

async def reset_password(data: ResetPasswordRequest) -> str:
    """
    Reset password using OTP verification.

    Args:
        data: email, otp, new_password, confirm_new_password

    Returns:
        Success message

    Raises:
        InvalidOtpError: If OTP is wrong or expired
        PasswordMismatchError: If new_password != confirm_new_password
    """
    # Validate passwords match (schema-level validation should catch this first)
    if data.new_password != data.confirm_new_password:
        raise PasswordMismatchError()

    email_normalized = data.email.lower().strip()

    # Find OTP for forgot_password purpose
    otp_record = await OTP.find_one(
        OTP.email == email_normalized,
        OTP.purpose == "forgot_password",
    )

    if not otp_record:
        raise InvalidOtpError()

    # Check expiry
    if datetime.now(timezone.utc) > otp_record.expires_at:
        await otp_record.delete()
        raise InvalidOtpError()

    # Verify OTP
    if not security.verify_otp_hash(data.otp, otp_record.otp_hash):
        raise InvalidOtpError()

    # Update password and delete OTP
    user = await User.find_one(User.email == email_normalized)
    if not user:
        await otp_record.delete()
        raise InvalidOtpError()

    user.password_hash = security.hash_password(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await user.save(update_fields=["password_hash", "failed_login_attempts", "locked_until"])

    await otp_record.delete()

    return "Password reset successfully"


# ===== LOGOUT =====

async def logout(refresh_token: str) -> str:
    """
    Logout user by deleting their refresh token.

    Args:
        refresh_token: The refresh token from httpOnly cookie

    Returns:
        Success message
    """
    try:
        payload = security.decode_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")

        if user_id:
            # Delete the refresh token from database
            await RefreshToken.find(
                RefreshToken.user_id == user_id,
                RefreshToken.token_hash == security.hash_otp_simple(refresh_token),
            ).delete()

    except Exception:
        # Even if token decode fails, we attempt cleanup silently
        pass

    return "Logged out successfully"