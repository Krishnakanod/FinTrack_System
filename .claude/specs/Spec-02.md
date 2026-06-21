# Spec-02 — Auth Module (Backend)

**Companion sprint doc:** `.claude/sprints/Sprint-02.md`
**Read order:** `Sprint-02.md` tells you WHAT to do and WHY. This document locks the exact contract. Where this doc gives an exact field name, status code, or error code, it is binding.

---

## 1. Locked Contracts

### 1.1 `users` Collection — Beanie Document Field Names
```python
class User(Document):
    email: str          # unique, indexed, lowercase-normalized before save
    name: str
    password_hash: str
    is_verified: bool = False
    avatar_url: str | None = None
    failed_login_attempts: int = 0
    locked_until: datetime | None = None   # None = not locked
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "users"
```
> `failed_login_attempts` and `locked_until` are additions beyond TRD.md §5.1's listed fields, needed to implement the lockout behavior from PRD US-02 — they are part of the `users` document, not a separate collection. This is the authoritative field list for `users` from this sprint forward.

### 1.2 `otps` Collection
```python
class OTP(Document):
    email: str                      # indexed
    otp_hash: str
    purpose: Literal["signup", "login", "forgot_password"]
    expires_at: datetime            # TTL index, 10 minutes from creation
    created_at: datetime

    class Settings:
        name = "otps"
```
- TTL index MUST be a real MongoDB TTL index on `expires_at` (`expireAfterSeconds=0`), not just an application-level check — Beanie/Motor index creation, configured at startup.

### 1.3 `refresh_tokens` Collection
```python
class RefreshToken(Document):
    user_id: str            # indexed
    token_hash: str
    expires_at: datetime    # TTL index, 7 days from creation

    class Settings:
        name = "refresh_tokens"
```

### 1.4 Request/Response Schemas — Exact Shapes

**`POST /api/v1/auth/signup`**
Request:
```json
{ "name": "string", "email": "string", "password": "string", "confirm_password": "string" }
```
- Password rule (locked): minimum 8 characters, at least one letter and one number. Reject anything weaker with `422`.
- `confirm_password` must equal `password` or reject with `422`.
Response — `201 Created`:
```json
{ "message": "OTP sent to your email" }
```
Response — `409 Conflict` (email already exists and is verified):
```json
{ "error": "EMAIL_ALREADY_EXISTS", "message": "An account with this email already exists.", "details": {} }
```
> Edge case (locked behavior): if a `User` exists with `is_verified=False` (abandoned signup), signup with that same email should be ALLOWED to proceed again — overwrite the password_hash and resend a fresh OTP, rather than blocking. Only a verified user blocks re-signup.

**`POST /api/v1/auth/verify-otp`**
Request:
```json
{ "email": "string", "otp": "string", "purpose": "signup" }
```
Response — `200 OK`:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": { "id": "string", "email": "string", "name": "string", "avatar_url": null }
}
```
Also sets `Set-Cookie: refresh_token=<token>; HttpOnly; Path=/api/v1/auth; SameSite=Lax` (add `Secure` in production — see §1.7).
Response — `400 Bad Request` (wrong/expired OTP):
```json
{ "error": "INVALID_OTP", "message": "The OTP is incorrect or has expired.", "details": {} }
```

**`POST /api/v1/auth/login`**
Request:
```json
{ "email": "string", "password": "string" }
```
Response — `200 OK`: identical shape to verify-otp's success response above.
Response — `401 Unauthorized` (bad credentials):
```json
{ "error": "INVALID_CREDENTIALS", "message": "Email or password is incorrect.", "details": {} }
```
Response — `403 Forbidden` (account locked):
```json
{ "error": "ACCOUNT_LOCKED", "message": "Too many failed attempts. Try again in 5 minutes.", "details": { "locked_until": "ISO8601 datetime" } }
```
Response — `403 Forbidden` (not verified):
```json
{ "error": "ACCOUNT_NOT_VERIFIED", "message": "Please verify your email before logging in.", "details": {} }
```
**Lockout rule (locked):** 3 consecutive failed attempts → set `locked_until = now + 5 minutes`, reset `failed_login_attempts` to 0 once lockout expires and a new attempt is made. A successful login resets `failed_login_attempts` to 0 immediately.

**`POST /api/v1/auth/forgot-password`**
Request:
```json
{ "email": "string" }
```
Response — `200 OK` (always, even if email doesn't exist — locked anti-enumeration behavior):
```json
{ "message": "If an account exists with this email, an OTP has been sent." }
```
> Do not return a different response for non-existent emails — this prevents user enumeration. If the email doesn't exist, simply don't send anything, but still return this same 200 response.

**`POST /api/v1/auth/reset-password`**
Request:
```json
{ "email": "string", "otp": "string", "new_password": "string", "confirm_new_password": "string" }
```
Response — `200 OK`:
```json
{ "message": "Password reset successfully" }
```
Response — `400 Bad Request`: same `INVALID_OTP` shape as verify-otp.

**`POST /api/v1/auth/refresh`**
Request: no body — reads `refresh_token` httpOnly cookie.
Response — `200 OK`:
```json
{ "access_token": "string", "token_type": "bearer" }
```
Response — `401 Unauthorized` (missing/invalid/expired cookie):
```json
{ "error": "INVALID_REFRESH_TOKEN", "message": "Session expired. Please log in again.", "details": {} }
```

**`POST /api/v1/auth/logout`**
Requires `Authorization: Bearer <access_token>`.
Response — `200 OK`:
```json
{ "message": "Logged out successfully" }
```
Also clears the `refresh_token` cookie (`Set-Cookie` with past expiry) and deletes the matching `RefreshToken` document.

### 1.5 JWT Claims (Locked Shape)
Access token payload:
```json
{ "sub": "<user_id>", "type": "access", "exp": <unix_ts>, "iat": <unix_ts> }
```
Refresh token payload:
```json
{ "sub": "<user_id>", "type": "refresh", "exp": <unix_ts>, "iat": <unix_ts> }
```
`core/security.py`'s `decode_token()` must reject a token if `type` doesn't match what's expected for the context (e.g. an access token used where a refresh token is expected) — this prevents token-type confusion attacks.

### 1.6 `core/deps.py` — `get_current_user` Contract
```python
async def get_current_user(authorization: str = Header(...)) -> User:
    ...
```
- Import path for all future modules: `from core.deps import get_current_user`
- Raises `HTTPException(401)` with body `{ "error": "UNAUTHORIZED", "message": "Invalid or missing authentication token.", "details": {} }` on any failure (missing header, malformed, expired, user not found).
- **This exact function name and import path is locked** — every module from Sprint 4 onward imports it verbatim.

### 1.7 Refresh Token Cookie Configuration (Locked)
```
Name: refresh_token
HttpOnly: true
Path: /api/v1/auth
SameSite: Lax
Secure: true in production (settings-driven — false acceptable for local http:// dev)
Max-Age: matches JWT_REFRESH_TTL_DAYS in seconds
```

### 1.8 OTP Generation Rule
6-digit numeric string, generated via a cryptographically reasonable random source (not `random.randint` with predictable seeding — use `secrets` module). Hashed with the same bcrypt mechanism as passwords before storage (or a faster hash like SHA-256 is acceptable for OTPs specifically since they're short-lived and rate-limited by expiry — document your choice).

---

## 2. Acceptance Scenarios

### Scenario 2.1 — Successful signup and verification
```gherkin
Given no user exists with email "krishna@test.com"
When I POST /api/v1/auth/signup with valid name, email, matching passwords
Then I receive 201 with { "message": "OTP sent to your email" }
And a User document exists with is_verified=false
And an OTP email arrives at krishna@test.com within a reasonable time
And an OTP document exists with purpose="signup", expiring in 10 minutes

When I POST /api/v1/auth/verify-otp with the correct 6-digit code
Then I receive 200 with an access_token and user object
And the refresh_token cookie is set
And the User document now has is_verified=true
And the OTP document has been deleted
```

### Scenario 2.2 — Signup with mismatched passwords
```gherkin
When I POST /api/v1/auth/signup with password="Passw0rd1" and confirm_password="Different1"
Then I receive 422
And no User or OTP document is created
```

### Scenario 2.3 — Signup with already-verified email
```gherkin
Given a User exists with email "taken@test.com" and is_verified=true
When I POST /api/v1/auth/signup with email="taken@test.com"
Then I receive 409 with error="EMAIL_ALREADY_EXISTS"
```

### Scenario 2.4 — Re-attempting signup on an unverified account
```gherkin
Given a User exists with email "abandoned@test.com" and is_verified=false (from a prior incomplete signup)
When I POST /api/v1/auth/signup again with email="abandoned@test.com" and a new password
Then I receive 201 (not 409)
And the User document's password_hash is updated to the new password
And a fresh OTP is generated and emailed
```

### Scenario 2.5 — Login lockout after 3 failures
```gherkin
Given a verified user exists with a known password
When I POST /api/v1/auth/login with the wrong password 3 times in a row
Then the 3rd attempt's response sets locked_until = now + 5 minutes
And a 4th attempt (even with the CORRECT password) within that window returns 403 ACCOUNT_LOCKED
And an attempt after locked_until has passed succeeds normally with the correct password
And failed_login_attempts resets to 0 after that successful login
```

### Scenario 2.6 — Forgot password does not leak account existence
```gherkin
When I POST /api/v1/auth/forgot-password with an email that does NOT exist in the system
Then I receive 200 with the generic "If an account exists..." message
And no OTP document is created
And no email is sent

When I POST /api/v1/auth/forgot-password with an email that DOES exist
Then I receive the exact same 200 response shape
And an OTP document IS created and an email IS sent
```

### Scenario 2.7 — Refresh token flow
```gherkin
Given a logged-in user with a valid refresh_token cookie
When the access token has expired (simulate by waiting or using a short TTL in test config)
And I POST /api/v1/auth/refresh (cookie sent automatically by browser/test client)
Then I receive 200 with a new access_token
And the new access_token works on a protected endpoint
```

### Scenario 2.8 — Protected route rejects missing/invalid token
```gherkin
When I call any endpoint requiring get_current_user with no Authorization header
Then I receive 401 with error="UNAUTHORIZED"

When I call it with an expired or malformed token
Then I receive 401 with error="UNAUTHORIZED"
```

---

## 3. Explicitly Out of Scope for This Sprint
- Friends/profile endpoints beyond what's needed for auth itself (Sprint 6)
- Any frontend (Sprint 3)
- Social login, MFA beyond OTP (not in PRD scope at all)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Exact bcrypt cost factor / OTP hashing algorithm chosen.
- Whether `core/email.py` or `modules/auth/email_utils.py` is the final location for the email utility (TRD.md leaves this open).
- Library choice for async SMTP (`aiosmtplib` vs. threadpool-wrapped `smtplib`).

---

*End of Spec-02.md*
