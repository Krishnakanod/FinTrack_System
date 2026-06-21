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

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 3 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., OTP step implementation: same-page state vs separate route]
- [e.g., toast library used: sonner / shadcn toast]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 5 needs to know:**
- Sidebar navigation component location and how to know the active route pattern
- How protected pages should be structured (do they live under app/dashboard/* and
  inherit the layout automatically?)
- Exact path to lib/api/client.ts and how other modules' API functions should follow
  the lib/api/auth.ts pattern

**What Sprint 6 needs to know:**
- lib/websocket.ts exists as a placeholder — implement and wire into
  app/dashboard/layout.tsx per TRD.md §12
```
