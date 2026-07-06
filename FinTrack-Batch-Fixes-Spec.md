# FinTrack — Batch Fixes & Feature Spec (Post-Sprint 9 / Pre-Sprint 10)

**Purpose:** This document specifies 22 fixes/features to be implemented by Claude Code in one or more fresh sessions. Each item includes the decision made, acceptance criteria, and — for bugs — the investigation Claude Code should perform before fixing (root cause not yet confirmed against the actual codebase).

**Stack reminder:** FastAPI monolith + MongoDB (backend), Next.js 14 (frontend), deployed on AWS EC2 / Vercel.

---

## A. UI / Navigation Fixes

### A1. Sidebar toggle icon
Replace the current small arrow icon with a standard 3-line hamburger icon (☰) for the sidebar collapse/expand toggle.
- **Acceptance:** Icon renders as 3 horizontal bars, same click behavior as before (collapse/expand sidebar), consistent sizing with other sidebar icons.

### A2. Dashboard nav item stuck "active" (BUG)
The "Dashboard" sidebar link stays visually highlighted regardless of which page is active.
- **Investigate first:** Find the active-link logic in the sidebar component (likely a `pathname` comparison). Suspect a `pathname.startsWith('/dashboard')` or similar loose match that fires on every route nested under `/dashboard/*`.
- **Acceptance:** Only the nav item matching the *exact* current route (or its intended section) is highlighted. Other items highlight correctly when their own route is active.

---

## B. Security / Confirmation Flows

### B1. Logout confirmation
Add a confirmation step before logging out.
- **Decision:** Simple "Are you sure you want to log out?" modal with Cancel / Log Out buttons. No password re-entry.
- **Acceptance:** Clicking Logout opens the modal; "Cancel" closes it with no action; "Log Out" proceeds with existing logout flow (clear session/token, redirect to login).

### B2. Confirmation before editing income
Add the same style of confirmation before an income transaction edit is saved.
- **Decision:** Same simple confirm-modal pattern as B1 (not password/OTP).
- **Acceptance:** On submitting an edit to an income transaction, show "Confirm changes to this income entry?" modal before the PATCH/PUT request fires. Confirm proceeds, Cancel returns to the edit form with values intact.

### B3. Lock transaction date on edit
Date field must not be editable once a transaction exists.
- **Acceptance:** In the edit-transaction form (income and expense), the date input is rendered disabled/read-only, pre-filled with the original date. Backend should also reject a changed `date` field on the edit endpoint (defense in depth — don't rely on frontend disabling alone).

---

## C. Non-Friend Payer / Income Source

### C1. Free-text name for non-friend income source
When logging income "from a friend," allow entering a plain name instead of requiring selection from the friends list.
- **Decision:** Plain text label only — no backend contact/user record created. Purely descriptive metadata on the transaction.
- **Data model:** Add an optional field, e.g. `source_name: string`, on the income transaction, used only when no `friend_id` is selected. Transaction should store either `friend_id` (existing friend) OR `source_name` (free text), not require both.
- **Acceptance:** Income form offers a toggle/radio: "Select from friends" vs "Enter name manually." Manual entry stores `source_name`; selecting a friend stores `friend_id` as before. Transaction list/detail views display whichever is present.

---

## D. Friend Requests

### D1. Friend request approval flow
Adding a friend requires approval from the recipient, not instant add.
- **Decision:** Sender **can cancel** a pending request before it's accepted.
- **Data model:** New collection/table `friend_requests` with fields: `sender_id`, `receiver_id`, `status` (`pending` / `accepted` / `rejected` / `cancelled`), `created_at`, `updated_at`.
- **Endpoints needed:**
  - `POST /friend-requests` — send request
  - `GET /friend-requests?type=incoming|outgoing` — list requests
  - `POST /friend-requests/{id}/accept`
  - `POST /friend-requests/{id}/reject`
  - `POST /friend-requests/{id}/cancel` (sender only, only while `pending`)
- **Acceptance:** Friends page shows an "Incoming Requests" and "Outgoing Requests" section/tab. Accepting creates a mutual friendship (however friendship is currently modeled — check existing `friends` collection/relation). Rejecting or cancelling just updates status, no friendship created.

---

## E. Bill Printing

### E1. Print personal transaction as a bill, with edit stamping
- **Decision:** Printing uses the browser's native print view (`window.print()` with a print-specific stylesheet), not a generated PDF. Editing a transaction does **not** block printing — instead, the printed bill is stamped "EDITED" if the transaction has been modified since creation.
- **Scope constraint:** Personal expense transactions only (not group transactions) for this phase.
- **Data model:** Transaction needs an `edited: boolean` flag (or compare `created_at` vs `updated_at`) set whenever an edit is saved.
- **Acceptance:** A "Print Bill" action on a personal transaction opens a print-friendly view/modal with transaction details (date, category, amount, note) and triggers `window.print()`. If `edited` is true, the printed layout includes a visible "EDITED" label/watermark near the top.

---

## F. Group Features

### F1. Remove "View Analytics" button from group modal
- **Acceptance:** Button removed from the group detail modal. (Analytics remains accessible via the dedicated group analytics page/tab if one exists elsewhere — confirm this isn't the only entry point before removing.)

### F2. Add member button — creator-only, friends-list only
- **Decision:** Only the group creator sees an "Add Member" button. It only allows adding people from the creator's existing friends list (not arbitrary users, not non-friends).
- **Acceptance:** Non-creator members do not see the button at all (not just disabled — hidden). Member picker is filtered to accepted friends who are not already in the group.

### F3. Delete group — creator-only
- **Acceptance:** "Delete Group" action is visible/enabled only for the group creator. Backend endpoint must also verify `creator_id == current_user.id` server-side (don't rely on frontend hiding).

### F4. Exit group — any member, but blocked if unsettled
- **Decision:** Any member can exit a group on their own, **except** the exit is blocked if that member currently has a non-zero balance (owes money or is owed money) within that group.
- **Acceptance:** "Exit Group" button available to all non-creator members (decide separately whether creator can exit their own group, or must delete it instead — flag this as an open question if the creator case isn't obvious from current group-ownership logic). If the member's net balance in the group is non-zero, show an error: "Settle your balance before exiting this group." If zero, proceed with removal from group membership.

### F5. Payer should not appear in their own split (BUG)
In a group transaction, the payer is incorrectly included as one of the people who "owes" a share.
- **Investigate first:** Find the split calculation logic (likely in the transaction creation/split service). Confirm current behavior: does it divide `amount / participant_count` including the payer, and then create a debt record for the payer to themselves?
- **Acceptance:** When a transaction is split among N participants including the payer, the payer's own share is **not** recorded as a debt (either exclude payer from the debtors list entirely, or net it out so payer's own share isn't double counted). Other members' owed amounts remain calculated correctly against the payer.

### F6. Groupwise analytics — total expense breakdown
- **Decision:** Show both numbers, separately: (1) total amount the user personally paid in the group, and (2) the user's actual share/liability across group transactions (i.e., what they're responsible for, regardless of who paid).
- **Acceptance:** Group analytics view shows two distinct figures, clearly labeled, e.g. "You Paid: ₹X" and "Your Share: ₹Y" (exact copy TBD by whoever builds the UI, but the two values must be computed and displayed separately, not merged).

### F7. Group activity notifications
- **Decision:** In-app only, delivered in real time via WebSocket (no email in this phase).
- **Scope:** Any group activity involving a member should notify all *other* members of that group — new transaction added, member added/removed, group edited, etc. (confirm exact trigger list against what activity logging already exists, if any).
- **Acceptance:** A WebSocket channel/room per group (or per user, fanned out to their groups) pushes a notification event on qualifying actions. Frontend shows an in-app notification (toast and/or notification center/bell) in real time without requiring a page refresh.

---

## G. Analytics & Data Bugs

### G1. CORS error blocking analytics data (BUG)
- **Investigate first:** Check FastAPI CORS middleware config (allowed origins, methods, headers) against the actual frontend origin making the analytics request (dev: likely `localhost:3000` or similar; prod: Vercel domain). Check whether the analytics endpoint sits behind a different router/prefix that might not have CORS middleware applied, or whether credentials/cookies are involved requiring `allow_credentials=True` with an explicit origin (not `*`).
- **Acceptance:** Analytics page loads data successfully with no CORS errors in console, in both dev and deployed environments.

### G2. Chart renders with 0 width/height (BUG)
Recharts error: container width/height is -1.
- **Investigate first:** Find the chart's parent container — likely missing an explicit height (Recharts' `ResponsiveContainer` needs a sized parent, not just `width: 100%`/`height: 100%` on a container with no intrinsic size).
- **Acceptance:** Chart renders correctly on first load and on window resize, no console errors, without needing a manual refresh.

### G3. Data resets to zero on page reload (BUG — likely high priority)
All data appears empty/zero immediately after a browser refresh.
- **Investigate first:** Check whether app state (transactions, groups, balances) lives only in a client-side store (e.g. Zustand/Redux) with no rehydration step — i.e., on reload the store resets to its initial empty state and nothing re-fetches from the backend. Check whether auth token/session also survives reload, since if auth is lost, all data-fetching calls would silently fail or never fire.
- **Acceptance:** After a full page reload while logged in, all previously visible data (transactions, groups, dashboard figures) reloads correctly from the backend without requiring the user to navigate away and back.

### G4. Recent activity should split by Personal vs Group view
- **Decision:** When the analytics page has a Personal/Group toggle, the "recent activity" feed shown should only include items matching the currently selected mode — not a merged feed.
- **Acceptance:** Selecting "Personal" shows only personal transaction activity; selecting "Group" shows only group transaction activity. No overlap.

---

## H. Profile & Settings (new features)

### H1. Edit username (Profile page)
- **Acceptance:** Profile page has an editable username field with save action, validation (uniqueness if usernames must be unique — confirm against current user model), and updates reflected across the app (sidebar, headers, etc.) after save.

### H2. Change password (Settings page)
- **Acceptance:** Settings page has a "Change Password" form: current password, new password, confirm new password. Validates current password server-side before updating. Standard password strength/match validation on the frontend.

### H3. Theme toggle — Light / Dark (Settings page)
- **Acceptance:** Settings page has a toggle/switch for Light/Dark theme. Preference persists across sessions (localStorage at minimum; consider syncing to user profile in backend if multi-device consistency matters — flag as open question if not already decided). Applies app-wide immediately on change.

---

## Open Items / Things to Confirm Once Claude Code Is In the Codebase

These couldn't be fully pinned down without seeing the actual code, and should be resolved as first steps in the relevant session rather than assumed:

1. **F4:** Can the group *creator* exit their own group, or must they delete the group instead? Current ownership model needs checking.
2. **D1:** Confirm how the existing `friends` relationship is modeled (single collection with mutual entries? two one-directional entries?) so the accept flow creates it consistently.
3. **F1:** Confirm the group modal's "View Analytics" button isn't the *only* path to group analytics before removing it — if it is, this needs a replacement entry point instead of pure removal.
4. **H3:** Whether theme preference should sync server-side (multi-device) or stay local-only (localStorage) for this phase.
5. **F7:** Exact list of "group activity" events that should trigger a notification — pull from any existing activity/audit log if one exists, otherwise define the list explicitly before building.

---

## Suggested Session Breakdown for Claude Code

Given the range of changes, this is too large for a single session. Suggested split:

- **Session 1 — Bug fixes (G1, G2, G3, A2, F5):** these are investigation-heavy and independent of new features; good to isolate.
- **Session 2 — Security/confirmation flows (B1, B2, B3):** small, self-contained, low risk.
- **Session 3 — Friend requests (D1) + non-friend income source (C1):** related data-model changes.
- **Session 4 — Group management (F2, F3, F4, F6, F7):** the biggest chunk, touches group schema and permissions most.
- **Session 5 — Profile/Settings (H1, H2, H3) + Bill printing (E1) + UI polish (A1, F1) + analytics view split (G4):** lower-risk, mostly additive.
