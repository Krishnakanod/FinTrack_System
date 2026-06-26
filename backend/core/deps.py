"""FastAPI dependencies for authentication."""

from fastapi import Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from modules.auth.models import User
from core import security


security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(authorization: str | None = Header(None)) -> User:
    """
    FastAPI dependency that validates JWT Bearer token and returns the User.

    Import path for all future modules:
        from core.deps import get_current_user

    Raises:
        HTTPException(401): If token is missing, malformed, expired, or user not found.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "UNAUTHORIZED",
                "message": "Authentication required. Please log in.",
                "details": {},
            },
        )

    try:
        # Parse Bearer token
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "UNAUTHORIZED",
                    "message": "Invalid authentication scheme.",
                    "details": {},
                },
            )

        token = authorization[len("Bearer ") :]

        # Decode and validate JWT
        payload = security.decode_token(token, expected_type="access")
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "UNAUTHORIZED",
                    "message": "Invalid token payload.",
                    "details": {},
                },
            )

        # Fetch user from database
        user = await User.get(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "UNAUTHORIZED",
                    "message": "User not found.",
                    "details": {},
                },
            )

        return user

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "UNAUTHORIZED",
                "message": "Invalid or missing authentication token.",
                "details": {},
            },
        )
