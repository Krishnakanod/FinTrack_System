# Pre-Sprint 10 — Bugfix & Polish Session

**Type:** Ad-hoc fix session (outside the numbered sprint system)
**Status:** Must be fully completed and verified BEFORE Sprint 10 (E2E/Deployment) begins
**Companion feature doc:** `docs/fixes/Settings-Feature-Spec.md` (items 6 and 8 — profile/settings/sidebar toggle — live there, not here)

---

## How to Use This Document

This is a self-contained Claude Code session guide. Read it fully before touching any file.

**Also read before starting:**
- `docs/TRD.md` — architecture source of truth (module structure, import conventions)
- `docs/sprints/Sprint-09.md` Handoff Notes — current state of the codebase
- `docs/specs/Spec-07.md` §1.2–1.4 — the locked group transaction and split contracts (item 9 touches this)
- `docs/specs/Spec-04.md` §1.2–1.4 — the locked expense/income schemas (items 1, 2, 3, 14 touch these)

**Do not assume anything. If any fix below references a file, component, or variable name that does not exist exactly as written in the actual codebase, stop and report the discrepancy before writing code.**

---

## Item Index

| # | Item | Layer | Risk |
|---|---|---|---|
| 1 | Remove "Add your first expense" CTA when filters are active | Frontend | Low |
| 2 | To-date must be ≥ from-date validation | Frontend | Low |
| 3 | Switching back to "All Categories" shows empty list without reload | Frontend | Medium |
| 9 | Custom split broken when payer is also in the split | Frontend + Backend | High |
| 10 | Recent activity not sorted by time | Backend | Low |
| 11 | Transaction detail modal on click in groups | Frontend | Medium |
| 12 | Option to change group name | Frontend + Backend | Low |
| 13 | Timezone audit + fix (both write-time and display-time) | Both | High |
| 14 | Validation error when editing expense/income date field | Frontend | Medium |

Work through them in this order — items 13 (timezone) must be done last since it may affect how items 1–12 interpret dates, and getting timezone wrong first would require revisiting other items' fixes.

---

## Item 1 — Remove "Add your first expense" CTA when filters are active

### Context
Currently, when the expense or income list is empty (no results), a blank-state CTA ("Add your first expense" / "Add your first income") appears. This CTA is correct when the user genuinely has NO data. It is WRONG when filters (category, date range) are active and simply return no matching results — showing a "you have no data" message when the user has data (just none matching the filter) is misleading.

### Locked Fix Contract

**Condition for showing the blank-state CTA (locked):**
```
Show CTA   →   list is empty   AND   no filters are currently active
                                      (category == null/undefined/"all"
                                       AND date_from == null/undefined
                                       AND date_to == null/undefined)

Show "No results for current filters"   →   list is empty   AND   any filter is active
```

**"No results" message copy (locked):**
- Expenses: `"No expenses match your current filters."`
- Income: `"No income entries match your current filters."`

**Reset filters affordance (locked):** alongside the "no results" message, show a text button or link: `"Clear filters"` that resets all active filters to their default (unset) state in one click.

**Applies to:** both `/dashboard/expenses` and `/dashboard/income` pages identically.

### Acceptance Scenarios

```gherkin
Scenario: Empty state with no filters active
  Given I have no expenses at all
  When I visit /dashboard/expenses with no filters set
  Then the blank-state CTA ("Add your first expense") is shown

Scenario: Empty state with filters active
  Given I have expenses in the "Food" category but none in "Transport"
  When I filter by category = "Transport"
  Then the CTA is NOT shown
  And the message "No expenses match your current filters." IS shown
  And a "Clear filters" button is visible

Scenario: Clear filters restores the list
  Given I am seeing the "no results" message with category="Transport" active
  When I click "Clear filters"
  Then all filter inputs reset to unset/default
  And all my expenses (including Food) are shown again
```

---

## Item 2 — To-date must be ≥ from-date validation

### Context
The date range filter on expenses and income allows a user to set a `date_to` that is earlier than `date_from`, which produces an impossible range and should either be blocked or auto-corrected.

### Locked Fix Contract

**Strategy (locked): auto-correct, not hard block.**
- When `date_from` is changed to a date AFTER the current `date_to`: automatically set `date_to = date_from` (same day range is valid — single-day filter).
- When `date_to` is changed to a date BEFORE the current `date_from`: automatically set `date_from = date_to`.
- Never show a validation error or disable the submit — silently auto-correct so the UX stays frictionless.
- Display a subtle helper text below the date range inputs (always visible, not just on error): `"From date cannot be after To date."` — this pre-educates the user so the auto-correct doesn't feel like a surprise.

**Applies to:** both `/dashboard/expenses` and `/dashboard/income` filter panels.

### Acceptance Scenarios

```gherkin
Scenario: Setting from-date after to-date auto-corrects to-date
  Given date_from = "2026-06-01" and date_to = "2026-06-30"
  When I change date_from to "2026-07-01" (after current date_to)
  Then date_to automatically updates to "2026-07-01"
  And no error message is shown
  And the filter query fires with from="2026-07-01" and to="2026-07-01"

Scenario: Setting to-date before from-date auto-corrects from-date
  Given date_from = "2026-06-15" and date_to = "2026-06-30"
  When I change date_to to "2026-06-10" (before current date_from)
  Then date_from automatically updates to "2026-06-10"
  And no error message is shown

Scenario: Equal from and to date is valid
  Given I set both date_from and date_to to "2026-06-20"
  Then the filter fires successfully and shows expenses for that single day
```

---

## Item 3 — Switching back to "All Categories" shows empty list without reload

### Context
This is a filter state bug. When a category filter is active and the user switches back to "All" (or clears the category), the list stays empty. The list only repopulates after a hard page reload. Root cause is almost certainly a stale TanStack Query cache key — the query key when `category=undefined` is resolving to a cached empty result from a previous filtered query, or the filter state change is not properly triggering a re-fetch.

### Locked Fix Contract

**Root cause to check first (before writing any fix):**
1. Inspect how the category filter state is stored (local React state, URL param, Zustand store).
2. Inspect the TanStack Query key for the expenses/income list — it must include the filter values: `['expenses', { category, date_from, date_to }]`. If the key does not change when filters change, the query will not re-fire.
3. Inspect whether "All Categories" sets `category` to `undefined`, `null`, `""`, or `"all"` — and whether the API call correctly omits the `category` param (or sends nothing) when the intent is "all categories." Sending `category=all` or `category=undefined` as a literal string to the backend would cause zero results since those aren't valid `ExpenseCategory` enum values.

**Locked fix (once root cause is confirmed):**
- Query key must be `['expenses', { category: category ?? null, date_from: date_from ?? null, date_to: date_to ?? null }]` — `null` for absent filters, never `undefined` inside the key object (TanStack Query treats object keys with `undefined` values inconsistently across versions).
- When category is "All", pass NO `category` param to the API (omit it from the query string entirely), not `category=all` or `category=undefined`.
- Same fix applies identically to the income list.

### Acceptance Scenarios

```gherkin
Scenario: Switching from a category filter back to All shows full list
  Given I have expenses in Food and Transport categories
  And I currently have category filter = "Food" active (showing only Food expenses)
  When I change the category filter back to "All"
  Then both Food and Transport expenses are shown immediately
  And no page reload is required
  And the network request omits the category query param entirely

Scenario: Filter state round-trip does not corrupt cache
  Given I switch Food → All → Transport → All in quick succession
  When I end on "All"
  Then all expenses are shown (not a stale subset from a previous filter)
```

---

## Item 9 — Custom split broken when payer is also in the split

### Context
**Confirmed correct behavior (from Krishna's answer):** if User A is `paid_by` AND selects themselves in the `split_among` list, User A's row in the custom split input should be fully editable like any other member's row. The payer's own share is a real debt they owe themselves (tracked in balances for accurate record-keeping). The current bug is that this case is either blocked, zeroed out, or crashes.

### Backend Fix — `groups/service.py`

**Current incorrect behavior in Spec-07 §1.2 (needs revision for this fix):**
Spec-07 §1.2 states: *"`splits` excludes the payer"* and *"the payer's own share is implicitly 'money they paid to themselves' and is NOT recorded as a debt."*

**This is now overridden by Krishna's explicit decision.** The corrected behavior:

```
splits CAN include an entry where user_id == paid_by.
When this happens:
  - The entry IS stored in the group_transaction.splits array like any other member
  - The balance update for this entry (paid_by owes paid_by) is a SELF-BALANCE —
    do NOT write a balance record for this case (a person cannot owe themselves;
    writing Balance{user_id: A, counterpart_id: A} would be nonsensical data)
  - The split IS included in the response and in transaction history for display
    (it shows A's own share of the expense for record-keeping purposes)
```

**Locked backend fix in `add_transaction` service:**
```python
for split in computed_splits:
    if split.user_id == paid_by:
        # Include in transaction record but skip balance update — self-balance is a no-op
        continue
    # existing balance update logic for non-self entries (unchanged)
    await upsert_balance(split.user_id, paid_by, +split.amount_owed)
    await upsert_balance(paid_by, split.user_id, -split.amount_owed)
```

**Equal split recalculation (locked):** when `split_type == "equal"` and `paid_by` IS in `split_among`, `paid_by`'s share is still calculated and stored in `splits` as a record, but is skipped in balance updates per above. The penny-rounding algorithm from Spec-07 §1.4 is unchanged — it operates over ALL members in `split_among` including the payer.

**Custom split validation (locked):** `sum(all splits including payer's own entry) == total_amount` — the validation must include the payer's row in the sum check, since the payer entered that amount deliberately.

### Frontend Fix — Group Transaction Form

**Current bug:** the custom split UI either hides the payer's row, disables it, or zeros it out when `paid_by` is also in `split_among`.

**Locked fix:** remove all special-casing of the payer's row in the custom split inputs. Every member in `split_among` — including whoever is selected as `paid_by` — gets a fully editable amount input. No greying out, no read-only state, no auto-zero.

**Visual distinction (locked):** add a small label or badge on the payer's row in the split list: `"(Paid by)"` — so it's clear who paid, without disabling their input. This is informational only, not a constraint.

**Live sum validation (unchanged from Spec-07):** the running sum displayed to the user must include the payer's row in the total. The "submit" button stays disabled until `sum(all rows) == total_amount`.

### Acceptance Scenarios

```gherkin
Scenario: Equal split including payer — stored and displayed correctly
  Given a group with members A (paid_by), B, C
  And split_type = "equal", split_among = [A, B, C], total = 900
  When A submits the transaction
  Then the stored splits array contains 3 entries: {A, 300}, {B, 300}, {C, 300}
  And Balance records are only created for B→A and C→A (A's self-entry skipped)
  And GET /balances for A shows B and C each owe A 300 (correct)
  And the transaction detail shows A's share as 300 (for record-keeping)

Scenario: Custom split including payer — form is fully editable
  Given paid_by = User A and split_among = [A, B, C], total = 900
  When I select split_type = "custom"
  Then A's row has a fully editable amount input (not disabled/read-only/zero)
  And A's row shows the "(Paid by)" label
  And entering A=400, B=300, C=200 enables the submit button (sum = 900)
  And entering A=300, B=300, C=200 keeps submit disabled (sum = 800 ≠ 900)

Scenario: Custom split with payer — balance correctness
  Given A paid 900, custom splits: A=400, B=300, C=200
  When the transaction is saved
  Then Balance{B→A} = 300, Balance{C→A} = 200
  And NO Balance{A→A} record exists in the database
```

---

## Item 10 — Recent Activity Not Sorted by Time

### Context
`GET /api/v1/analytics/recent-activity` merges expenses, income, and group transactions but does not appear to sort the merged result correctly — items are out of chronological order.

### Root Cause to Check First
Inspect `modules/analytics/service.py`'s `get_recent_activity()` function:
1. Are all three source collections fetched with the same date field? (`expenses.date`, `income.date`, `group_transactions.date` — confirm all three use the same field name)
2. Is the merge-and-sort happening in Python after fetching, or is it attempted in MongoDB? (A Python-level sort is simpler and less error-prone here.)
3. Is the date field being compared as `datetime` objects or as strings? String comparison of ISO dates works correctly only if all dates are in the same format and timezone — if some are UTC-naive and some are timezone-aware, Python's sort will raise a TypeError or silently produce wrong order.

### Locked Fix Contract

**Locked sort implementation:**
```python
from operator import attrgetter

def get_sort_key(item: RecentActivityItem) -> datetime:
    dt = item.date
    # Normalize: if naive (no tzinfo), treat as UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

merged = expenses_items + income_items + group_tx_items
merged.sort(key=get_sort_key, reverse=True)   # descending: most recent first
return merged[:limit]
```

**The `date` field on `RecentActivityItem` in the response must be an ISO 8601 string in UTC** (consistent with all other date fields across the API — display conversion to IST happens on the frontend per item 13's fix). Do not convert to IST at this serialization point.

### Acceptance Scenarios

```gherkin
Scenario: Recent activity is sorted most-recent-first across all types
  Given I have (in this creation order, NOT date order):
    - An income entry dated 2026-06-01
    - An expense dated 2026-06-20
    - A group transaction dated 2026-06-10
  When I GET /api/v1/analytics/recent-activity?limit=10
  Then the items array order is:
    1. expense (2026-06-20)
    2. group transaction (2026-06-10)
    3. income (2026-06-01)
  Regardless of which was created/inserted first

Scenario: Same-day items have a consistent tiebreaker order
  Given two items both dated 2026-06-20 but created at different times
  Then the one with the later created_at appears first
  (Add created_at as a secondary sort key if not already present)
```

---

## Item 11 — Transaction Detail Modal in Groups

### Context
Currently clicking a transaction row in a group's transaction list does nothing (or navigates away). The desired behavior: a modal/drawer slides up showing the full transaction detail.

### Locked Contract

**Trigger:** clicking anywhere on a transaction row in the group transaction list opens the modal.

**Modal content (locked fields to display):**
```
Title:        "{description}"
Amount:       "₹{total_amount}"
Date:         formatted in IST (e.g. "20 Jun 2026") — after timezone fix (item 13)
Paid by:      "{paid_by_user.name}"
Split type:   "Equal" | "Custom"
Splits section (one row per split entry):
  "{member_name}"  →  "₹{amount_owed}"  [+ "(you)" label if member is the current user]
  [settled badge if is_settled == true, greyed out if false — no settle button in this scope]
```

**Modal does NOT include:** edit or delete actions for the transaction (not in scope for this fix session — keep the modal read-only).

**Data source:** the transaction object already loaded in the group detail page's TanStack Query cache is sufficient — **no additional API call is needed** to open the detail modal. Use the data already in `['groups', groupId, 'transactions']` cache. The modal simply reads from the clicked item in the existing list.

**Member name resolution:** the group detail page already fetches group members (populated user objects per Spec-07 §1.6). Use that member list to resolve `paid_by` and each `split.user_id` to display names. Do not fire new API calls for name resolution inside the modal.

### Acceptance Scenarios

```gherkin
Scenario: Clicking a transaction row opens the detail modal
  Given I am on /dashboard/groups/[id] with transactions loaded
  When I click on any transaction row
  Then a modal/drawer opens without a page navigation or new API call
  And the modal shows: description, total amount, date (IST), paid-by name,
    split type, and all split entries with member names and amounts

Scenario: Current user's split entry is labelled "(you)"
  Given the current user (A) appears in the transaction's splits list
  When the modal opens for that transaction
  Then A's split entry shows "A's name (you)  →  ₹{amount}"

Scenario: Modal closes correctly
  When I click outside the modal or press Escape
  Then the modal closes
  And the transaction list is still visible and unchanged
```

---

## Item 12 — Option to Change Group Name

### Context
Currently group name is set at creation and cannot be edited. Need a simple edit capability.

### Backend Fix

**`PUT /api/v1/groups/groups/{id}`** already exists per Spec-07/TRD §6.6. Verify it:
- Accepts `{ "name": "string" }` in the request body (partial update — only `name` is editable; `description` optionally too)
- Returns `200` with the updated group object
- Returns `403` if the requesting user is not a member (existing behavior)
- **New validation (locked):** `name` must not be empty string. Return `422` with:
  ```json
  { "error": "VALIDATION_ERROR", "message": "Group name cannot be empty.", "details": {} }
  ```

**If `PUT /api/v1/groups/groups/{id}` is not yet implemented** (the sprint doc listed it but it may have been skipped): implement it now per the contract above.

### Frontend Fix

**Where to add the edit affordance (locked):** on the group detail page (`/dashboard/groups/[id]`), the group name shown in the header/title area gets an edit icon (pencil icon) next to it. Clicking the icon converts the name to an inline text input with Save/Cancel buttons. This is an inline-edit pattern, NOT a separate settings page or modal — keep it simple.

**Locked UX flow:**
```
Group name displayed as text + pencil icon
  → click pencil
  → name converts to inline input (pre-filled with current name), pencil replaced by ✓ Save and ✕ Cancel
  → click Save → PUT /api/v1/groups/groups/{id} with { "name": new_name }
  → on success: name updates in place, returns to display mode, TanStack Query invalidates ['groups', groupId]
  → on empty name: show inline error "Group name cannot be empty" (don't fire the API call at all)
  → click Cancel → discard changes, return to display mode
```

### Acceptance Scenarios

```gherkin
Scenario: Edit group name successfully
  Given I am a member viewing /dashboard/groups/[id] with name "Trip to Goa"
  When I click the pencil icon next to the group name
  And I change the text to "Goa 2026" and click Save
  Then the API receives PUT /groups/groups/{id} with { "name": "Goa 2026" }
  And the page header immediately shows "Goa 2026" without a reload

Scenario: Empty name is blocked before API call
  Given I am in inline-edit mode for the group name
  When I clear the input field and click Save
  Then no API call is fired
  And inline error "Group name cannot be empty" is shown

Scenario: Cancel discards changes
  When I change the name to something new and click Cancel
  Then the original name is restored and no API call is made
```

---

## Item 13 — Timezone Audit & Fix

### Context
Krishna confirmed both write-time bugs (wrong date saved) AND display-time bugs (UTC shown instead of IST) exist. This item is structured as a **two-phase audit-then-fix**, since the exact files/lines in the real codebase must be inspected before a generic fix can be safely applied.

### Phase 1 — Audit (Do This Before Writing Any Fix Code)

**Backend audit — check these files/patterns:**
```
1. Any place a `datetime` is created with `datetime.utcnow()` or `datetime.now()`
   without a timezone argument — these produce naive datetimes that Motor/MongoDB
   stores as UTC but which lose timezone context, making display-side conversion
   unreliable.
   FIX: replace with `datetime.now(timezone.utc)` throughout.

2. Any place a date-only string (e.g. "2026-06-20") is parsed from a request body
   without explicit timezone handling.
   FIX: parse as `datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)`
   — not IST, because the frontend is responsible for sending the user's intended
   date as a UTC midnight equivalent after local-to-UTC conversion (see frontend
   audit below).

3. The APScheduler timezone setting in modules/budgets/scheduler.py:
   MUST be timezone="Asia/Kolkata" (already specified in TRD.md §9.3 and
   Spec-08 §1.3 — verify this is actually what's in the file, not "UTC").

4. Period range calculations in shared/period_utils.py (if extracted, per
   Spec-08/Spec-09) or wherever budget/analytics period math lives:
   All "today", "start of month", "start of quarter" calculations MUST use
   IST as the reference timezone, not UTC or local server time.
   FIX: use `pytz.timezone('Asia/Kolkata')` or `zoneinfo.ZoneInfo('Asia/Kolkata')`
   consistently throughout period utils.
```

**Frontend audit — check these files/patterns:**
```
1. Date pickers (in expense, income, group transaction forms): what value do they
   produce when a user selects "2026-06-20"?
   - If they produce a Date object interpreted as local time (UTC+5:30), then
     sending it as .toISOString() gives "2026-06-19T18:30:00.000Z" — which the
     backend parses as June 19, not June 20. This is the write-time bug.
   FIX: when converting a calendar date selection to a string for the API, use
   the date string directly ("2026-06-20") without converting to a JS Date object
   that introduces timezone shift. Send as "YYYY-MM-DD" and let the backend treat
   it as UTC midnight.

2. Date display (expense list, income list, group transactions, analytics, recent
   activity): are dates shown in UTC or IST?
   All displayed dates must convert the UTC ISO string from the API to IST
   (+5:30) before formatting.
   FIX: create a shared utility function (locked name and location):
   `lib/utils/format-date.ts` exporting:
     formatDateIST(isoString: string, format?: 'date' | 'datetime'): string
   - 'date' → "20 Jun 2026"
   - 'datetime' → "20 Jun 2026, 11:30 PM"
   Use this function EVERYWHERE a date is displayed — replace any ad-hoc
   `new Date(str).toLocaleDateString()` calls, which use the browser's local
   timezone (may not be IST if the user's device is in a different timezone).

3. Recent activity dates (item 10) — after the sort fix, confirm the date
   displayed per item uses formatDateIST().

4. Transaction detail modal (item 11) — confirm it uses formatDateIST().
```

### Phase 2 — Fix (After Audit Is Complete)

**Report to Krishna before implementing:** present the full audit findings as a list:
```
Backend issues found:
  - [file:line] datetime.utcnow() → replace with datetime.now(timezone.utc)
  - [file:line] date string parsed without timezone → fix
  - [file:line] scheduler timezone setting → confirm/fix
  - [file:line] period utils using wrong timezone reference → fix

Frontend issues found:
  - [file:line] date picker submitting UTC-shifted value → fix
  - [file:line] date displayed with toLocaleDateString() (not formatDateIST) → fix
  - [file:line, file:line, ...] all occurrences to replace
```

Then implement all fixes in one pass after Krishna confirms the audit list looks right.

### Locked Contracts (Apply During Fix Phase)

**Canonical timezone rule (locked, applies to the entire codebase from this fix forward):**
```
Storage:  always UTC (MongoDB stores all datetimes as UTC — do not change this)
Backend computation: always convert to Asia/Kolkata BEFORE any "today", "this month",
  "this quarter" calculation
API transport: always UTC ISO 8601 strings (e.g. "2026-06-19T18:30:00.000Z")
Frontend display: always convert UTC → IST using formatDateIST() before showing to user
Frontend input: date pickers submit YYYY-MM-DD string (not a JS Date object); backend
  interprets this as UTC midnight
```

**`lib/utils/format-date.ts` — Locked Implementation:**
```typescript
import { format } from 'date-fns';  // or date-fns-tz if already installed; if neither,
                                     // use Intl.DateTimeFormat — document your choice
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;  // +5:30

export function formatDateIST(
  isoString: string,
  mode: 'date' | 'datetime' = 'date'
): string {
  const utcMs = new Date(isoString).getTime();
  const istDate = new Date(utcMs + IST_OFFSET_MS);
  if (mode === 'datetime') {
    // e.g. "20 Jun 2026, 11:30 PM"
    return istDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + istDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  // e.g. "20 Jun 2026"
  return istDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
```

### Acceptance Scenarios

```gherkin
Scenario: Expense saved with correct date (write-time fix)
  Given it is any time of day for a user in IST timezone
  When I fill in the expense form with date "2026-06-20" and save
  Then the expense retrieved from GET /api/v1/expenses/ shows date "2026-06-20"
  (NOT "2026-06-19" due to UTC-shift — the saved date in MongoDB will be
  2026-06-19T18:30:00Z which is correct UTC-midnight-IST for June 20)

Scenario: Expense date displayed in IST
  Given an expense stored with date "2026-06-19T18:30:00.000Z" (UTC midnight IST June 20)
  When it appears in the expense list
  Then it shows "20 Jun 2026" (IST), NOT "19 Jun 2026" (UTC)

Scenario: Budget period evaluation uses IST midnight as day boundary
  Given it is 11:00 PM IST on June 30 (which is 5:30 PM UTC June 30)
  When the APScheduler budget evaluation runs
  Then it calculates the monthly budget period as June 1–30 IST
  (NOT misidentifying the current month as July because UTC date is still June 30)

Scenario: formatDateIST handles both date-only and datetime display correctly
  Given isoString = "2026-06-19T18:30:00.000Z"
  When formatDateIST(isoString, 'date') is called
  Then it returns "20 Jun 2026"
  When formatDateIST(isoString, 'datetime') is called
  Then it returns "20 Jun 2026, 12:00 AM" (midnight IST)
```

---

## Item 14 — Validation Error When Editing Expense/Income Date Field

### Context
When editing an existing expense or income entry, changing the date field triggers a validation error, even though the same date value works fine on creation. All other fields edit without issue.

### Root Cause to Check First

The most common causes of this pattern:

```
1. The edit form pre-fills the date field from the API response (an ISO datetime
   string like "2026-06-20T00:00:00Z") into a date picker that expects "YYYY-MM-DD".
   The picker rejects the full datetime string as invalid, marks the field as
   errored, and the Zod schema or React Hook Form validation catches it on submit.

2. The PUT request sends the date as a full ISO datetime string (with time component)
   when the backend's Pydantic schema expects a date-only string or vice versa —
   type mismatch only caught during the edit flow, not creation (since creation's
   form always submits a date-only string from the picker).

3. The date field in the update Pydantic schema is typed as `date` (not `datetime`)
   while creation uses `datetime`, or the field is non-optional in the update schema
   when it should accept partial updates.
```

### Locked Fix Contract

**Backend fix (if applicable — check audit findings):**
- The expense and income `UpdateSchema` must accept the date field as an OPTIONAL `str | None` (partial update) and parse it the same way as the create schema does.
- No type mismatch between create and update handling of dates.

**Frontend fix (most likely the primary fix):**
When pre-filling the edit form, convert the ISO datetime string from the API to a `YYYY-MM-DD` string for the date picker:
```typescript
// WRONG (causes validation error):
defaultValues: { date: expense.date }  // "2026-06-20T00:00:00.000Z"

// CORRECT:
defaultValues: { date: expense.date.split('T')[0] }  // "2026-06-20"
```
This must be applied consistently to both the expense edit form and the income edit form.

**Zod schema for the date field in edit forms (locked):**
```typescript
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
```
This ensures only valid date strings (not datetime strings) pass validation, and gives a clear error message if somehow a datetime string slips through.

### Acceptance Scenarios

```gherkin
Scenario: Edit expense — change date without validation error
  Given an existing expense with date "2026-06-20"
  When I open the edit form
  Then the date field shows "2026-06-20" (not a datetime string or empty)
  When I change the date to "2026-06-25" and submit
  Then no validation error occurs
  And the expense is updated with date "2026-06-25"

Scenario: Edit income — same behavior
  Given an existing income entry
  When I open the edit form and change only the date field
  Then no validation error occurs on submit

Scenario: Edit other fields without touching date — unchanged behavior
  Given an existing expense
  When I open the edit form and change only the amount (not the date)
  Then no validation error occurs (this already works — regression test to confirm
  the date fix doesn't break non-date field edits)
```

---

## Overall Definition of Done for This Session

Before marking this session complete and moving to `Settings-Feature-Spec.md` (items 6 and 8), every item below must be checked:

- [x] Item 1: "Add first expense" CTA hidden when filters active; "no results" message + "Clear filters" shown instead
- [x] Item 2: Date range auto-corrects on both expenses and income; no invalid ranges can be submitted
- [x] Item 3: Switching to "All Categories" immediately shows full list without page reload; TanStack Query key fix confirmed
- [x] Item 9: Payer's row editable in custom split; "(Paid by)" label shown; backend skips self-balance write; equal split stores all members including payer
- [x] Item 10: Recent activity sorted correctly across all three types by date descending, with created_at tiebreaker
- [x] Item 11: Transaction detail modal opens on row click, shows all locked fields, closes correctly, fires no additional API calls
- [x] Item 12: Pencil icon inline edit for group name works; empty name blocked; Cancel restores original
- [x] Item 13: Timezone audit report presented to Krishna and confirmed; all write-time and display-time fixes applied; `lib/utils/format-date.ts` created and used everywhere; all acceptance scenarios pass
- [x] Item 14: Edit form pre-fills date as YYYY-MM-DD; date field edit no longer triggers validation error on both expense and income

---

## Handoff Notes to Sprint 10

### Pre-Sprint 10 Bugfix Session Handoff

**Items fully resolved:** 1, 2, 3, 9, 10, 11, 12, 13, 14

**Items partially resolved:** None

**Timezone audit findings:**
  - Backend: replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` in auth, expenses, income, and analytics/pdf_report; added explicit UTC tzinfo to date filter parsing in expenses/income; added UTC tzinfo to report range in analytics.
  - Frontend: created `lib/utils/format-date.ts` with `formatDateIST`; replaced ad-hoc `toLocaleDateString()` displays in expenses, income, groups, notifications, dashboard, and header; replaced default "today" generation with IST-based date strings.
  - Full audit report: `docs/fixes/Pre-Sprint-10-Timezone-Audit.md`
  - `formatDateIST` location: `frontend/lib/utils/format-date.ts`

**Item 9 — custom split behavior change note for Sprint 10:**
  - Spec-07 §1.2's statement "splits excludes the payer" is now OVERRIDDEN.
  - The payer CAN appear in splits. Backend skips balance write for self-entries.
  - Sprint 10's full-flow E2E test (Spec-10 §1.2 step 8) should include a test where the transaction creator (paid_by) is also in the split, to confirm this fix holds in the full deployed flow.

**Items 6 and 8 (settings/profile/sidebar toggle):**
  - Document `docs/fixes/Settings-Feature-Spec.md` does not exist yet; skipped per Krishna's instruction. Revisit once the spec is provided.

**Any regressions introduced:** None found during TypeScript and Python syntax checks.