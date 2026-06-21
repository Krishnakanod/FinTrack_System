# Sprint 5 — Expense + Income Frontend

**Layer:** Frontend
**Depends on:** Sprint 3 (dashboard shell, API client pattern), Sprint 4 (expense + income backend)
**Estimated files touched:** ~16-20

---

## Context to Read First

1. `docs/PRD.md` — Section 3.2, 3.3 (Expense and Income user stories)
2. `docs/TRD.md` — Section 6.4, 6.5 (API endpoint reference)
3. `docs/App-Flow.md` — Section 4, 5, 6 (Add Expense Manual, Add Expense OCR, Add Income flows)
4. **Read `.claude/sprints/Sprint-04.md` → Handoff Notes** for exact request/response JSON shapes and the OCR confidence threshold value.
5. **Read `.claude/sprints/Sprint-03.md` → Handoff Notes** for the dashboard layout pattern, API client location, and how to add new pages under `app/dashboard/`.
6. Frontend-design skill — review before building, to keep visual consistency with Sprint 3's auth pages.

---

## Goal

Build the Expenses page (list, manual add, OCR add with review step, edit, delete) and the Income page (list, add, edit, delete). Wire both into TanStack Query for caching/invalidation. Update the dashboard overview with real net balance and recent activity now that real data exists.

---

## Tasks

### 1. API Functions
- `lib/api/expenses.ts` — `createExpense()`, `uploadReceiptOcr()`, `confirmOcrExpense()`, `listExpenses()`, `updateExpense()`, `deleteExpense()` — following the pattern from `lib/api/auth.ts` (Sprint 3).
- `lib/api/income.ts` — `createIncome()`, `listIncome()`, `updateIncome()`, `deleteIncome()`.

### 2. TanStack Query Setup
- Query keys: `['expenses', filters]`, `['income', filters]`.
- Mutations for create/update/delete invalidate the relevant list query AND `['analytics']` (placeholder key for now — analytics module doesn't exist until Sprint 9, but invalidating early-bound query keys now means Sprint 9 "just works" once that query is added).

### 3. Expenses Page (`app/dashboard/expenses/page.tsx`)
- Table/list view of expenses (shadcn `Table` or card list — your call, keep consistent with frontend-design skill), showing category icon, description, amount, date, payment type.
- Filter controls: category dropdown, date range picker.
- "Add Expense" button opens a Sheet/Dialog with two tabs or a toggle: "Manual Entry" / "Scan Receipt".
  - **Manual tab:** form per `App-Flow.md` §4 — Category, Description, Amount, Date (default today), Payment Type. React Hook Form + Zod.
  - **OCR tab:** file upload (drag-drop or click), calls `uploadReceiptOcr()`, shows a loading state, then pre-fills the SAME form fields as manual entry (still editable). If `confidence_score` is below the threshold from Sprint 4's Handoff Notes, show a yellow warning banner per `App-Flow.md` §5. Submit button says "Confirm & Save" and calls `confirmOcrExpense()`.
  - If OCR returns no extractable data, show a toast ("Couldn't read receipt — please fill manually") and fall back to an empty manual form, per `App-Flow.md` §5.
- Edit: click a row → opens the same form pre-filled, calls `updateExpense()`.
- Delete: confirmation dialog (shadcn `AlertDialog`) → calls `deleteExpense()`.

### 4. Income Page (`app/dashboard/income/page.tsx`)
- Table/list view of income entries.
- "Add Income" button opens a form per `App-Flow.md` §6:
  - Source Type toggle: Salary / From Friend
  - If "From Friend": a searchable dropdown — **friends list doesn't exist until Sprint 6.** For this sprint, stub this dropdown with a disabled state and a tooltip "Friend selection available after Friends module ships" OR use a plain text input for friend name as a temporary placeholder. Document your choice clearly in Handoff Notes since Sprint 6/7 will need to come back and wire this properly.
  - Description, Date (default today), Amount, Payment Type.
- Edit/Delete follow the same pattern as Expenses.

### 5. Dashboard Overview Update (`app/dashboard/page.tsx`)
- Replace Sprint 3's placeholder cards with real data:
  - Net Balance card: `sum(income) - sum(expenses)` — compute client-side from the two list queries for now (a dedicated `/analytics/net-balance` endpoint arrives in Sprint 9; using raw lists here is fine for this sprint's scope and the dashboard widget gets upgraded then)
  - Recent Activity feed: merge expenses + income, sort by date desc, show last 10 (client-side merge for now, same reasoning as above)
- Keep this code isolated enough that Sprint 9 can swap the data source without restructuring the page (e.g., extract a `<NetBalanceCard amount={...} />` presentational component now).

### 6. Playwright Tests
- `tests/expenses.spec.ts` — add manual expense, verify it appears in list; upload a test receipt image fixture, verify OCR pre-fill, confirm save; edit an expense; delete an expense.
- `tests/income.spec.ts` — add salary income, verify it appears; edit; delete.
- Add a small fixture receipt image under `tests/fixtures/sample-receipt.jpg` for the OCR test (a simple receipt photo/screenshot with a visible total amount is enough).

---

## Definition of Done

- [ ] Expenses page: list, filter, manual add, OCR add (with review/edit step), edit, delete all work
- [ ] OCR low-confidence warning banner displays correctly when applicable
- [ ] Income page: list, add (both source types), edit, delete all work
- [ ] Dashboard shows real net balance and recent activity (not placeholders)
- [ ] `tests/expenses.spec.ts` and `tests/income.spec.ts` pass
- [ ] "From Friend" income dropdown stub is clearly marked as temporary (comment + Handoff Note)

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 5 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., how the "From Friend" dropdown was stubbed]
- [e.g., table vs card list choice for expense/income display]

**Known issues / deferred items:**
- Income "From Friend" picker needs proper wiring once Sprint 6 ships the friends list
  — [exact file/line to revisit]
- Dashboard net balance / recent activity computed client-side; should be swapped to
  use /analytics/* endpoints in Sprint 9 — [exact component to revisit]

**What Sprint 6 needs to know:**
- File/line where the Income "From Friend" dropdown stub lives, so it can be properly
  wired to GET /api/v1/users/friends once that endpoint exists

**What Sprint 9 needs to know:**
- Presentational components extracted for net balance / recent activity:
  [component names and paths] — these can be reused, just swap the data source
```
