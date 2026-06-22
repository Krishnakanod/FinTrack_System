### Sprint 2 Handoff Notes

**What was built:**
- Complete `auth` module: models, schemas, services, router with 7 endpoints
- `core/security.py` with password/OTP/JWT utilities
- `core/deps.py` with `get_current_user` dependency
- Updated `core/database.py` with auth models
- Async SMTP email utility in `core/email.py`
- Global exception handling

**Decisions made (not in TRD.md):**
- Email utility in `core/email.py` (not `auth/` subfolder) for future reuse
- In-collection failed login tracking (fields in `User` model)
- bcrypt cost factor 12 for password/OTP hashing
- `aiosmtplib` for async-safe email sending
- Password complexity validation (1 letter + 1 number) at schema level

**Known issues / deferred items:**
- None

**What Sprint 3 needs to know:**
- Exact endpoint contracts:
```json
// POST /api/v1/auth/signup (201)
{"message": "OTP sent to your email"}

// POST /api/v1/auth/verify-otp (200)
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "avatar_url": null
  }
}
// Set-Cookie: refresh_token (httpOnly, path=/api/v1/auth)

// POST /api/v1/auth/login (200)
// (Same response structure as verify-otp)

// POST /api/v1/auth/forgot-password (200)
{"message": "If an account exists with this email..."}

// POST /api/v1/auth/reset-password (200)
{"message": "Password reset successfully"}

// POST /api/v1/auth/refresh (200)
{"access_token": "string", "token_type": "bearer"}

// POST /api/v1/auth/logout (200)
{"message": "Logged out successfully"}
```
- Refresh token cookie:
  ```
  Name: refresh_token
  httpOnly: true
  Path: /api/v1/auth
  SameSite: lax
  Secure: false in development, true in production
  Max-Age: 604800 (7 days)
  ```
- Critical import paths:
  ```python
  from core.deps import get_current_user  # For protected routes
  from modules.auth.service import (login, signup, verify_otp, ...)  # For future auth interactions
  ```

**What Sprint 4 and Sprint 6 need to know:**
- `get_current_user` dependency is stable and ready for import
- Protected routes MUST include:
  ```python
  from core.deps import get_current_user
  @router.get("/protected", dependencies=[Depends(get_current_user)])
  ```
- Password validation rules: 8+ chars, at least one letter and one number (enforced in `auth/schemas`)
- Use `core/security.py`'s password/OTP utilities for consistency