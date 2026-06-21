# Spec-03 — Auth Frontend + Dashboard Shell

**Companion sprint doc:** `.claude/sprints/Sprint-03.md`
**Prerequisite reading:** `.claude/sprints/Sprint-02.md` Handoff Notes (exact JSON shapes), `Spec-02.md` (authoritative contract if Handoff Notes are ambiguous).

---

## 1. Locked Contracts

### 1.1 Zustand Auth Store Shape (`lib/store/auth-store.ts`)
```typescript
interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; name: string; avatar_url: string | null } | null;
  isAuthenticated: boolean;   // derived: !!accessToken && !!user
  setAuth: (accessToken: string, user: AuthState['user']) => void;
  clearAuth: () => void;
}
```
- **Only `user` is persisted** (e.g. via Zustand `persist` middleware to `localStorage` or sessionStorage equivalent that's safe in this environment) — `accessToken` must NOT survive a hard page reload; it is re-acquired via silent refresh on app load. This is a security requirement, not a style choice.
- Store name/file path `lib/store/auth-store.ts` is locked — `lib/websocket.ts` (Sprint 6) and all future API modules will import from this exact path.

### 1.2 API Client Contract (`lib/api/client.ts`)
Must export a function (name your choice, but document it) with this behavior contract:
1. Prefixes all requests with `process.env.NEXT_PUBLIC_API_BASE_URL`.
2. Attaches `Authorization: Bearer <accessToken>` from the auth store on every request except `/auth/signup`, `/auth/login`, `/auth/verify-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`.
3. On a `401` response from any OTHER endpoint: calls `POST /api/v1/auth/refresh` exactly once, and if that succeeds, retries the original request with the new token. If refresh also fails (401), calls `clearAuth()` and redirects to `/login`.
4. Parses non-2xx JSON bodies matching the backend's `{ error, message, details }` shape (per `TRD.md` §6.1) and throws/returns an object preserving all three fields so calling code can show `message` in a toast and `details` as field errors.
5. Includes credentials (cookies) on requests — required for the refresh-token cookie to be sent. (`fetch(..., { credentials: 'include' })` or axios `withCredentials: true`.)

### 1.3 Auth API Functions (`lib/api/auth.ts`) — Exact Function Signatures
```typescript
signup(data: { name: string; email: string; password: string; confirm_password: string }): Promise<{ message: string }>
verifyOtp(data: { email: string; otp: string; purpose: 'signup' | 'forgot_password' }): Promise<{ access_token: string; token_type: string; user: User }>
login(data: { email: string; password: string }): Promise<{ access_token: string; token_type: string; user: User }>
forgotPassword(data: { email: string }): Promise<{ message: string }>
resetPassword(data: { email: string; otp: string; new_password: string; confirm_new_password: string }): Promise<{ message: string }>
logout(): Promise<{ message: string }>
```
These exact names/signatures are locked since they directly mirror Spec-02's request/response contracts.

### 1.4 Routes (Locked Paths)
```
/login
/signup
/forgot-password
/dashboard                  (protected — auth guard layout)
```
Route group naming (`app/(auth)/...` vs flat) is your choice, but the **URL paths above are locked** since they may be referenced by name in later sprint docs or tests.

### 1.5 Zod Validation Rules (Must Match Backend Exactly)
- Password: min 8 chars, at least 1 letter + 1 number (must match Spec-02 §1.4 backend rule exactly, so client-side and server-side rejection criteria agree — a password the frontend accepts must never be rejected by the backend for complexity reasons, and vice versa).
- Email: standard email format validation.
- `confirm_password` / `confirm_new_password`: must equal the corresponding password field.

### 1.6 Protected Route Behavior (`app/dashboard/layout.tsx`)
```gherkin
On mount:
  If auth store has no `user` →
    attempt POST /api/v1/auth/refresh
    If success → store new access_token, fetch/restore user (see note below), render children
    If failure → redirect to /login
  If auth store already has `user` → render children immediately (no redundant refresh call)
```
> Note: since only `user` (not `accessToken`) persists across reloads, a successful `/auth/refresh` only returns a new access token, NOT the user object (per Spec-02 §1.4 — refresh response is `{ access_token, token_type }` only). Use the persisted `user` from the store for display, paired with the freshly acquired `accessToken`. If the persisted `user` is also missing (e.g. first-ever load on a new device with only a valid cookie), you'll need a way to fetch the user profile — for this sprint, it's acceptable to redirect to `/login` in that edge case if `user` isn't in the persisted store, since `GET /api/v1/users/me` doesn't exist until Sprint 6. Document this limitation in Handoff Notes.

### 1.7 Dashboard Shell — Required Navigation Items (Locked Set, Order Your Choice)
Sidebar must contain links to exactly these sections (paths to be created in later sprints — link them now even if the destination page doesn't exist yet, or conditionally hide until built; document your choice):
```
Dashboard, Expenses, Income, Friends, Groups, Balances, Budget, Analytics, Notifications
```

---

## 2. Acceptance Scenarios

### Scenario 3.1 — Full signup-to-dashboard flow
```gherkin
Given I am on /signup
When I fill in name, email, password, confirm_password (valid, matching) and submit
Then I am taken to an OTP entry step
When I enter the correct OTP (retrieved from test email or backend test hook)
Then I am redirected to /dashboard
And the dashboard shell (sidebar + header) is visible
And my name appears somewhere in the header/user menu
```

### Scenario 3.2 — Login with invalid credentials shows inline error
```gherkin
Given I am on /login
When I submit with an incorrect password
Then I see an error message (the backend's "message" field, not a generic fallback)
And I remain on /login
```

### Scenario 3.3 — Forgot/reset password full flow
```gherkin
Given I am on /forgot-password
When I submit my registered email
Then I see a confirmation message (the generic anti-enumeration message)
When I enter the correct OTP and a new valid password (with matching confirmation)
Then my password is updated
And I can subsequently log in with the NEW password (and the old one no longer works)
```

### Scenario 3.4 — Unauthenticated access to /dashboard redirects
```gherkin
Given I have no valid session (no user in store, no valid refresh cookie)
When I navigate directly to /dashboard
Then I am redirected to /login
And I do not see any flash of dashboard content before the redirect
```

### Scenario 3.5 — Hard reload preserves session
```gherkin
Given I am logged in and viewing /dashboard
When I perform a hard browser reload
Then I remain on /dashboard (not redirected to /login)
And the dashboard shell renders correctly after the silent refresh completes
```

### Scenario 3.6 — Logout clears session
```gherkin
Given I am logged in
When I click Logout
Then I am redirected to /login
And the auth store's user and accessToken are both cleared
And navigating back to /dashboard afterward redirects to /login again
```

### Scenario 3.7 — 401 mid-session triggers silent refresh + retry
```gherkin
Given I am logged in with a soon-to-expire access token
When I make an API call that returns 401 because the token just expired
Then the client automatically calls /auth/refresh
And retries the original request with the new token
And the original request succeeds without the user seeing an error
```

---

## 3. Explicitly Out of Scope for This Sprint
- Any page content beyond placeholders for Expenses/Income/Friends/Groups/Balances/Budget/Analytics/Notifications (built in their respective sprints)
- Real WebSocket connection (placeholder function signature only, per Sprint-03.md Task 7)
- `GET /api/v1/users/me` integration (doesn't exist until Sprint 6)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- OTP step: same-page multi-step form vs. separate `/verify-otp` route.
- Toast library (shadcn `sonner` or built-in `toast`).
- How nav items for not-yet-built pages are handled (linked-but-empty vs. disabled/hidden).
- Persistence mechanism for the `user` object (localStorage via Zustand `persist`, or other).

---

*End of Spec-03.md*
