# Sprint 2 — Auth Module (Backend)

**Layer:** Backend
**Depends on:** Sprint 1 (scaffold)
**Estimated files touched:** ~10-12

---

## Context to Read First

1. `docs/PRD.md` — Section 3.1 (Authentication user stories US-01, US-02, US-03)
2. `docs/TRD.md` — Section 4 (JWT Auth Flow), Section 5.1-5.3 (users/otps/refresh_tokens schemas), Section 6.2 (Auth API endpoints), Section 3 (Module Structure — see `modules/auth/` layout)
3. `docs/App-Flow.md` — Section 2 (Signup → First Login flow), Section 3 (Login flow)
4. `docs/Manual-Setup.md` — Section 3 — **confirm Krishna has a Gmail App Password ready.** If not, STOP and ask for it (needed for OTP emails this sprint).
5. **Previous sprint's Handoff Notes:** read `.claude/sprints/Sprint-01.md` → "Handoff Notes" section at the bottom (Krishna will have filled this in) for the exact state of `core/config.py`, `core/database.py`, and folder layout.

---

## Goal

Build the complete `modules/auth/` backend module: signup with OTP email verification, login with JWT issuance, refresh token flow, forgot/reset password — all fully functional and testable via curl/Postman, no frontend yet.

---

## Tasks

### 1. Models (`modules/auth/models.py`)
Beanie Documents per `TRD.md` §5.1-5.3:
- `User` (collection: `users`) — email (unique indexed), name, password_hash, is_verified, avatar_url, created_at, updated_at
- `OTP` (collection: `otps`) — email (indexed), otp_hash, purpose (`signup|login|forgot_password`), expires_at (TTL index), created_at
- `RefreshToken` (collection: `refresh_tokens`) — user_id (indexed), token_hash, expires_at (TTL index)

Register all three in `core/database.py`'s `document_models` list.

### 2. Core Security Utilities (`core/security.py`)
- `hash_password(plain: str) -> str` / `verify_password(plain, hashed) -> bool` (passlib bcrypt)
- `create_access_token(user_id: str) -> str` (15-min TTL from settings)
- `create_refresh_token(user_id: str) -> str` (7-day TTL from settings) + store its hash in `refresh_tokens` collection
- `decode_token(token: str) -> dict` (raises on invalid/expired)
- `generate_otp() -> str` (6-digit numeric)
- `hash_otp(otp: str) -> str` / `verify_otp_hash(otp, hashed) -> bool`

### 3. Core Dependency (`core/deps.py`)
- `get_current_user(authorization: str = Header(...)) -> User` — FastAPI dependency that:
  - Extracts Bearer token
  - Decodes via `decode_token`
  - Fetches and returns the `User` document
  - Raises `401` if invalid/expired/user not found
  - **This dependency will be imported by every other module starting Sprint 4 — keep its signature stable.**

### 4. Email Utility (`modules/auth/email_utils.py` or `core/email.py` — your call, document in Handoff Notes)
- SMTP send function using Gmail App Password from `.env` (`GMAIL_USER`, `GMAIL_APP_PASSWORD`)
- Simple HTML template for OTP emails (subject varies by purpose: "Verify your FinTrack account" / "Your FinTrack password reset code")
- Keep it synchronous-safe for async context (use `aiosmtplib` or run in threadpool — your call)

### 5. Schemas (`modules/auth/schemas.py`)
Pydantic models: `SignupRequest`, `VerifyOtpRequest`, `LoginRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `TokenResponse` (access_token, token_type), `UserResponse` (id, email, name, avatar_url).

### 6. Service Logic (`modules/auth/service.py`)
Implement per `App-Flow.md` §2 and §3:
- `signup(data: SignupRequest) -> None`:
  - Check email uniqueness (raise 409 if taken)
  - Create `User` with `is_verified=False`, hashed password
  - Generate + hash OTP, save with `purpose="signup"`, `expires_at=now+10min`
  - Send OTP email
- `verify_otp(data: VerifyOtpRequest) -> TokenResponse`:
  - Look up OTP by email+purpose, check hash match and expiry
  - Set `user.is_verified=True`
  - Delete the OTP doc
  - Issue access + refresh tokens
- `login(data: LoginRequest) -> TokenResponse`:
  - Verify email exists, password matches, `is_verified=True`
  - Track failed attempts (simple in-collection counter or in-memory — document choice); lock for 5 min after 3 failures
  - Issue access + refresh tokens
- `forgot_password(data: ForgotPasswordRequest) -> None`: same OTP pattern, `purpose="forgot_password"`
- `reset_password(data: ResetPasswordRequest) -> None`: verify OTP, update `password_hash`, delete OTP
- `refresh_access_token(refresh_token: str) -> TokenResponse`: validate against `refresh_tokens` collection, issue new access token
- `logout(refresh_token: str) -> None`: delete the refresh token record

### 7. Router (`modules/auth/router.py`)
Wire up all endpoints from `TRD.md` §6.2:
```
POST /api/v1/auth/signup
POST /api/v1/auth/verify-otp
POST /api/v1/auth/login
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/refresh      (reads refresh token from httpOnly cookie)
POST /api/v1/auth/logout       (JWT required)
```
- `login` and `verify-otp` set the refresh token as an httpOnly cookie (`Set-Cookie`) AND return the access token in the JSON body, per `TRD.md` §4.
- Register this router in `main.py`.

### 8. Error Handling
- Add a global exception handler in `main.py` (if not already from Sprint 1) for a custom `AppException` base class → returns `{"error": "...", "message": "...", "details": {...}}` per `App-Flow.md` §13.
- Auth-specific exceptions: `EmailAlreadyExistsError`, `InvalidOtpError`, `OtpExpiredError`, `InvalidCredentialsError`, `AccountLockedError`, `InvalidRefreshTokenError`.

### 9. Verification (curl examples to run manually)
```bash
# Signup
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Passw0rd!","confirm_password":"Passw0rd!"}'

# Check email inbox for OTP, then:
curl -X POST http://localhost:8000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Passw0rd!"}'
```

### 10. Basic Tests (optional but recommended)
- `backend/tests/test_auth.py` using `pytest` + `httpx.AsyncClient` — at minimum, test signup→verify→login happy path against a test database (use a separate `fintrack_test` DB name in test config, or mongomock if preferred — document choice).

---

## Definition of Done

- [ ] All 7 auth endpoints implemented and manually verified via curl
- [ ] OTP emails actually arrive (verify with real Gmail App Password)
- [ ] JWT access token works for a protected dummy route (you can add a temporary `GET /api/v1/auth/me` using `get_current_user` to prove the dependency works — this becomes the real `users/me` endpoint in Sprint 6)
- [ ] Refresh token flow tested (expire access token manually by setting a short TTL temporarily, or just verify the refresh endpoint logic directly)
- [ ] Account lockout after 3 failed logins verified
- [ ] Passwords are bcrypt-hashed in the database (manually inspect via MongoDB Atlas UI or `mongosh`)
- [ ] OTPs are hashed at rest (not stored in plaintext)
- [ ] `core/deps.py`'s `get_current_user` is stable and ready for other modules to import

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 2 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., email utility location, failed-login-tracking mechanism chosen]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 3 needs to know:**
- Exact request/response shapes for: signup, verify-otp, login, forgot-password,
  reset-password, refresh, logout (paste actual JSON examples here)
- How the refresh token cookie is named and configured (httpOnly, secure flags, path)
- get_current_user dependency import path: `from core.deps import get_current_user`

**What Sprint 4 and Sprint 6 need to know (they'll import get_current_user too):**
- [confirm import path is stable]
```
