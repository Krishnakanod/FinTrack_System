# Sprint 3 — Auth Frontend + Dashboard Shell

**Layer:** Frontend
**Depends on:** Sprint 2 (auth backend)
**Estimated files touched:** ~15-18

---

## Context to Read First

1. `docs/PRD.md` — Section 3.1 (Authentication user stories)
2. `docs/TRD.md` — Section 2 (Frontend tech stack: Zustand, TanStack Query, shadcn), Section 4 (JWT flow), Section 10.6 (frontend folder structure)
3. `docs/App-Flow.md` — Section 1 (Navigation Map), Section 2 (Signup flow), Section 3 (Login flow)
4. `docs/Implementation-Plan.md` — Section 6, Sprint 3 summary
5. **Read `.claude/sprints/Sprint-02.md` → Handoff Notes** for exact request/response JSON shapes and the refresh-token cookie configuration — this sprint cannot proceed correctly without that.
6. `/mnt/skills/public/frontend-design/SKILL.md` equivalent guidance — read your project's frontend-design skill before building any UI, for visual polish/consistency from the start.

---

## Goal

Build all auth pages (Login, Signup, OTP verification, Forgot/Reset Password), the Zustand auth store, an API client with automatic token-refresh-on-401, a protected route wrapper, and the dashboard shell layout (sidebar/header navigation) that every future page will live inside. Dashboard itself is empty/placeholder — real widgets come in later sprints.

---

## Tasks

### 1. API Client (`lib/api/client.ts`)
- Wrapper around `fetch` (or axios) that:
  - Prefixes all calls with `NEXT_PUBLIC_API_BASE_URL`
  - Attaches `Authorization: Bearer <access_token>` from the Zustand auth store
  - On `401` response: calls `/api/v1/auth/refresh` (cookie-based, no body needed) once, retries the original request with the new token; if refresh also fails, clears auth store and redirects to `/login`
  - Surfaces backend error shape (`{error, message, details}`) in a way calling code can use for toasts/field errors

### 2. Auth Store (`lib/store/auth-store.ts`)
- Zustand store: `accessToken`, `user` (id, name, email, avatar_url), `isAuthenticated` (derived), `setAuth()`, `clearAuth()`
- Persist `user` (not the access token — access token should NOT survive a hard refresh for security; rely on refresh-token cookie + silent refresh on app load instead)

### 3. Auth API Functions (`lib/api/auth.ts`)
Thin wrapper functions calling the client for each Sprint 2 endpoint: `signup()`, `verifyOtp()`, `login()`, `forgotPassword()`, `resetPassword()`, `logout()`. Use the exact request shapes from Sprint 2's Handoff Notes.

### 4. Pages — Auth Group (`app/(auth)/`)
Using shadcn `Card`, `Input`, `Button`, `Form` components + React Hook Form + Zod validation:
- `app/(auth)/login/page.tsx` — email, password, "Forgot password?" link, "Sign up" link
- `app/(auth)/signup/page.tsx` — name, email, password, confirm password → on submit, navigate to an OTP step (either same page with local state, or `app/(auth)/verify-otp/page.tsx` — your call, document choice)
- `app/(auth)/forgot-password/page.tsx` — email → OTP step → new password step (can be one page with steps, or split — document choice)
- Each form uses Zod schemas matching backend validation (e.g., password complexity if backend enforces it — check Sprint 2 Handoff Notes)
- Toast notifications (shadcn `sonner` or `toast`) for errors/success

### 5. Protected Route Wrapper
- `app/dashboard/layout.tsx` acts as the auth guard: on mount, if no `user` in store, attempt silent refresh via `/auth/refresh`; if that fails, redirect to `/login`. If it succeeds, render children.
- This layout ALSO renders the dashboard shell (sidebar + header) — see Task 6.

### 6. Dashboard Shell
- Sidebar navigation (collapsible on mobile) with links to all sections from `App-Flow.md` §1: Dashboard, Expenses, Income, Friends, Groups, Balances, Budget, Analytics, Notifications.
- Header: app logo/name, notification bell icon (placeholder — wired up in Sprint 8), user avatar/name with a dropdown containing "Logout".
- `app/dashboard/page.tsx` — empty dashboard with placeholder cards (e.g., "Net Balance: —", "Recent Activity: coming soon") styled per the frontend-design skill so it doesn't look like a wireframe, even though it has no real data yet.
- Logout button calls `logout()` API function, clears Zustand store, redirects to `/login`.

### 7. WebSocket Hook Placeholder
- Create `lib/websocket.ts` with the connection function signature documented in `TRD.md` §12, but **do not wire it into the layout yet** — real implementation happens in Sprint 6 once the backend WebSocket route exists. Leave a clear `// TODO: implement in Sprint 6, see TRD.md §7 and §12` comment.

### 8. Playwright Tests (`tests/auth.spec.ts`)
Per `TRD.md` §11.2-11.3:
- Signup → OTP verify → redirected to dashboard
- Login with valid credentials → redirected to dashboard
- Login with invalid credentials → error shown
- Forgot password → reset → can log in with new password
- Accessing `/dashboard` while logged out → redirected to `/login`
- Use `test.beforeAll`/`afterAll` to create/clean up a test user via direct API calls (not through the UI) where appropriate, to keep tests fast — but the signup/login flows themselves SHOULD go through the UI since that's what's being tested.

---

## Definition of Done

- [ ] All auth pages built and styled (not default/unstyled HTML)
- [ ] Signup → OTP → dashboard flow works end-to-end manually
- [ ] Login → dashboard flow works end-to-end manually
- [ ] Forgot/reset password flow works end-to-end manually
- [ ] Logout clears session and redirects to login
- [ ] Refreshing the dashboard page (hard reload) keeps the user logged in (silent refresh works)
- [ ] Visiting `/dashboard` directly while logged out redirects to `/login`
- [ ] `tests/auth.spec.ts` passes (`npx playwright test auth.spec.ts`)
- [ ] Dashboard shell (sidebar, header, logout) renders correctly on desktop and mobile widths
- [ ] **Password visibility toggle** (eye button) available on all password input fields
- [ ] **Resend OTP functionality** with 1-minute countdown timer on signup and forgot-password flows

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 3 Handoff Notes

**What was built:**
- Zustand auth store (`lib/store/auth-store.ts`) with user persistence to localStorage,
  accessToken in memory only, and `_hasHydrated` flag for persist middleware hydration timing
- API client (`lib/api/client.ts`) upgraded with Bearer token attachment, credentials: include
  for refresh cookie, 401→refresh→retry cycle, and backend error shape surfacing
- Auth API functions (`lib/api/auth.ts`) — typed wrappers for signup, verifyOtp, login,
  forgotPassword, resetPassword, logout — exact signatures per Spec-03 §1.3
- WebSocket placeholder (`lib/websocket.ts`) with TODO comment for Sprint 6
- Root layout (`app/layout.tsx`) updated with Providers wrapper (Toaster + auth hooks init)
- Auth pages:
  - `/login` — email + password form with "Forgot password?" and "Sign up" links
  - `/signup` — multi-step: details form → OTP verification step → redirect to `/login`
  - `/forgot-password` — multi-page flow: email form → OTP + new password form → redirect to `/login`
- Protected route wrapper (`app/dashboard/layout.tsx`) — auth guard with Zustand hydration wait,
  sidebar + header + main content layout
- Dashboard page (`app/dashboard/page.tsx`) — placeholder stat cards, recent activity, quick actions
- Dashboard shell components:
  - `components/dashboard/sidebar.tsx` — 9 nav items (Dashboard active, 8 marked "Coming soon")
  - `components/dashboard/header.tsx` — user name, avatar icon, logout button
- Playwright tests (`tests/auth.spec.ts`) — 16 tests covering login, signup, forgot-password,
  protected routes, and dashboard shell (all passing)

**Decisions made (not in TRD.md):**
- **OTP flow (Krishna-specified):** Signup → OTP step → redirect to `/login` (NOT dashboard).
  Forgot password: email page → OTP + new password page → redirect to `/login`.
- **Toast library:** `sonner` (shadcn recommended), installed via `npx shadcn@latest add sonner`
- **Nav items for unbuilt pages:** Rendered as disabled (opacity-50 with "Soon" label) in sidebar
- **User persistence:** Zustand `persist` middleware with `localStorage`, partialize to `user` only
- **Auth guard approach:** Dashboard layout checks `user` from store (not `isAuthenticated`).
  Uses `_hasHydrated` flag to wait for Zustand persist hydration before redirecting.
  `accessToken` intentionally does NOT persist — API client handles silent refresh on 401.
- **Zod v4 API:** `z` is a named export (not default). Validation uses `.regex()` for complexity.
- **Next.js 16:** Actual version is 16.2.9 (docs say 14). App Router patterns are compatible.

**Known issues / deferred items:**
- The `setAuth` method in auth store passes `null` as accessToken during rehydration
  (`onRehydrateStorage` calls `state.setAuth(null as any, state.user)`) — this works
  because `isAuthenticated` is set to `true` by `setAuth`, but the accessToken remains null.
  The API client's 401-refresh-retry cycle handles this gracefully.
- `GET /api/v1/auth/me` endpoint exists on backend but is not integrated into the frontend
  refresh flow yet — on hard reload, the persisted `user` is used with the freshly acquired
  access token. If user is missing but refresh succeeds, no profile fetch happens. This is
  acceptable per Spec-03 §1.6 note.

## Sprint 3.1 Enhancements (Post-Sprint-3 Additions)

### Password Visibility Toggle (Eye Icon Button)
**Files Modified:** 
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/signup/page.tsx`
- `frontend/app/(auth)/forgot-password/page.tsx`

**Implementation:**
- Added `import { Eye, EyeOff } from "lucide-react"` to each auth page
- For each password input field:
  - Wrapped Input in a relative container
  - Added eye/eye-off icon button overlay on the right side
  - Toggle button switches `type="password"` ↔ `type="text"`
  - Added `showPassword`/`showConfirmPassword`/`showNewPassword` state variables
  - Set `autoComplete={showPassword ? "off" : "current-password/new-password"}` for better browser behavior

**User Experience:**
- Users can now see what they're typing in password fields
- Eye icon appears inside the input box on the right side
- Clicking toggles between hidden and visible password text

---

### Resend OTP with 1-Minute Countdown Timer
**Backend Files Modified/Created:**
- `backend/modules/auth/schemas.py` — Added `ResendOtpRequest` schema with `email` and `purpose` fields
- `backend/modules/auth/service.py` — Added `resend_otp()` function that:
  - Deletes existing OTP for email+purpose (invalidates old OTP)
  - Generates new OTP and creates fresh record with 10-min TTL
  - Sends email based on purpose (signup or forgot_password)
- `backend/modules/auth/router.py` — Added POST `/api/v1/auth/resend-otp` endpoint

**Frontend Files Modified:**
- `frontend/lib/api/auth.ts` — Added `resendOtp()` API function
- `frontend/app/(auth)/signup/page.tsx` — Sign-up OTP verification page
- `frontend/app/(auth)/forgot-password/page.tsx` — Reset password OTP page

**Implementation Details:**
- Added `useEffect` import and `timeLeft`, `resendOtpLoading` state variables
- Countdown timer starts at 60 seconds when OTP step becomes active
- Timer displays "Resend available in MM:SS" format (e.g., "00:59", "00:32")
- "Resend OTP" button is disabled during countdown
- When timer reaches 0, clickable "Resend OTP" button appears
- Clicking resends new OTP, invalidates old one, resets timer to 60s
- Timer automatically resets when navigating away from OTP page

**Visual Placement:**
- Resend button/timer displayed below OTP input field
- Text countdown shown while disabled
- Button appears only after cooldown expires

---

**What Sprint 5 needs to know:**
- Sidebar nav component is at `components/dashboard/sidebar.tsx`. It uses `usePathname()`
  to highlight the active route. Pages should live under `app/dashboard/<feature>/page.tsx`
  (they automatically inherit the dashboard layout).
- `lib/api/client.ts` is the base fetch function with auth interceptor. Other modules should
  follow the `lib/api/auth.ts` pattern: import `apiFetch` + define typed wrappers + export
  both types and functions.
- All API functions use the `apiFetch` generic for automatic error handling.
- Toast library is `sonner` — use `import { toast } from "sonner"`.

**What Sprint 6 needs to know:**
- `lib/websocket.ts` exists as a placeholder — implement and wire into
  `app/dashboard/layout.tsx` per TRD.md §12
- The sidebar has `className="hidden w-64 ... lg:block"` — the sidebar is hidden on mobile.
  Sprint 6 should add a hamburger menu toggle if the WebSocket connection is to be used
  on mobile views.
- `components/providers.tsx` initializes auth hooks and renders `Toaster` — if Sprint 6
  adds additional providers (QueryClientProvider for TanStack Query), add them here.

**Sprint 3.1 Enhancements Summary:**
- **Password visibility toggles** added to all password inputs using lucide-react's Eye/EyeOff icons
- **Resend OTP with countdown timer** implemented:
  - Backend: New `/api/v1/auth/resend-otp` endpoint that invalidates old OTP and sends new one
  - Frontend: 1-minute cooldown timer displayed below OTP input
  - Timer resets when clicking "Resend OTP" or navigating away from OTP page
```
