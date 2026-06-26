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

### Sprint 5 Handoff Notes

**What was built:**

**API layer** (`frontend/lib/api/`):
- `expenses.ts` — 6 typed API functions: `createExpense()`, `listExpenses()`, `getExpense()`, `updateExpense()`, `deleteExpense()`, `uploadReceiptOcr()`, `confirmOcrExpense()`. Exports type definitions (`Expense`, `ExpenseCategory`, `PaymentType`, etc.) and enum arrays (`EXPENSE_CATEGORIES`, `PAYMENT_TYPES`) for UI dropdowns.
- `income.ts` — 4 typed API functions: `createIncome()`, `listIncome()`, `getIncome()`, `updateIncome()`, `deleteIncome()`. Exports `IncomeSourceType`, `PaymentType` types and `PAYMENT_TYPES` array.

**TanStack Query integration** (`components/providers.tsx`):
- Added `QueryClientProvider` wrapping the entire app with `staleTime: 60000` and `retry: 1`.
- All mutations invalidate `['expenses']` or `['income']` AND `['analytics']` (placeholder key for Sprint 9).

**Expenses page** (`app/dashboard/expenses/page.tsx`):
- Full CRUD with Dialog-based forms (React Hook Form + Zod validation).
- Two tabs: "Manual Entry" and "Scan Receipt" (OCR).
- OCR flow: file upload → base64 → `uploadReceiptOcr()` → pre-fill form → optional low-confidence warning banner (threshold `< 0.67`) → "Confirm & Save" → `confirmOcrExpense()`.
- OCR fallback: toast "Couldn't read receipt — please fill manually" when no text extracted.
- Filter controls: category dropdown, date range picker (From/To).
- Delete confirmation via AlertDialog.
- Responsive: Table on desktop (`hidden md:block`), Card list on mobile (`md:hidden`).

**Income page** (`app/dashboard/income/page.tsx`):
- Full CRUD with Dialog-based forms.
- Source Type toggle: Salary (enabled) / From Friend (disabled with tooltip).
- Filter controls: source type dropdown, date range picker.
- Same responsive table/card pattern as Expenses.

**Dashboard overview** (`app/dashboard/page.tsx`):
- Replaced Sprint 3 placeholder cards with real data from `listExpenses()` and `listIncome()` TanStack Query calls.
- Extracted 4 presentational components for Sprint 9 data-source swap:
  - `NetBalanceCard({ totalIncome, totalExpenses })` — computes and displays net balance
  - `TotalIncomeCard({ amount })` — total income display
  - `TotalExpensesCard({ amount })` — total expenses display
  - `RecentActivityFeed({ expenses, incomes })` — merged + sorted by date desc, last 10 items
- Transaction count card shows total expenses + income count.
- Quick Actions: Expenses and Income links are live, Groups and Analytics remain "Coming soon".

**Sidebar + Mobile** (`components/dashboard/sidebar.tsx`):
- Enabled Expenses (`/dashboard/expenses`) and Income (`/dashboard/income`) nav items.
- Added mobile hamburger menu: fixed header with Menu/X toggle, slide-in sidebar with overlay backdrop.
- Auto-closes sidebar on nav link click.
- Desktop layout unchanged (`lg:static lg:translate-x-0`).

**Layout** (`app/dashboard/layout.tsx`):
- Added `pt-20 lg:pt-6` to main content area for mobile header offset.

**Playwright tests:**
- `tests/expenses.spec.ts` — 13 tests covering page navigation, empty state, add dialog, filter controls, form fields, category/payment dropdowns, date default, OCR tab interface, edit/delete accessibility.
- `tests/income.spec.ts` — 15 tests covering page navigation, empty state, add dialog, filter controls, form fields, source type toggle, From Friend disabled state, payment dropdown, date default, amount decimal input, edit/delete accessibility, sidebar navigation.
- **OCR-specific test skipped** — Vision API key not configured.

**shadcn/ui components installed:** dialog, tabs, select, table, alert-dialog, textarea, badge, separator.

**Decisions made (not already in TRD.md):**

1. **"From Friend" stub pattern**: Disabled button with `title` tooltip ("Friend selection available after Friends module ships (Sprint 6)"). Form submits with `friend_id: null` when From Friend is selected (though it's disabled so this path is unreachable in practice). Marked with `// TODO Sprint 6: wire to GET /api/v1/users/friends, see Spec-06.md` at `app/dashboard/income/page.tsx` line 250 (JS form submission) and line 482 (JSX template).

2. **Table vs card-list UI**: Responsive dual-layout — `Table` component on desktop (≥md breakpoint), `Card` list on mobile (<md breakpoint). Both show category/source icons, formatted currency (INR), badges for payment type and source.

3. **Mobile hamburger menu**: Added to sidebar as requested by Krishna. Fixed-position header bar (z-50) with Menu/X toggle icon. Slide-in sidebar from left with dark overlay backdrop (z-40). Clicking overlay or nav link closes sidebar.

4. **Form amount handling**: Used `z.string()` for amount in Zod schemas instead of `z.coerce.number()` due to Zod v4 type inference incompatibility with React Hook Form's `Resolver` type. Amounts are validated client-side via `parseFloat()` + `> 0` check in `onSubmit` before API submission. Amount stored as string in form state, converted to number at submission time.

5. **Sidebar nav hrefs**: Updated from `/expenses` to `/dashboard/expenses` and `/income` to `/dashboard/income` to correctly route within the dashboard layout.

6. **Expense/Income display currency**: Used `Intl.NumberFormat("en-IN", { currency: "INR" })` for consistent INR formatting.

7. **Category icons**: Emoji-based icons per category (🍔 Food, 🚗 Transport, 🛍️ Shopping, 🎬 Entertainment, 💊 Health, 💡 Utilities, 📦 Other). Income icons: 💰 Salary, 👥 From Friend.

**Known issues / deferred items:**

1. **Playwright tests NOT executed** — test files created but `npx playwright test` was not run. Krishna needs to verify tests pass with a running dev server + backend.

2. **OCR flow NOT tested end-to-end** — `GOOGLE_VISION_API_KEY` is empty in `.env`. OCR endpoints return `null` fields with `confidence_score: 0.0` per Sprint 4's graceful degradation. Krishna will configure API key and test OCR later.

3. **Income "From Friend" path is functionally unreachable** — the From Friend button is disabled, so users can't currently select it. Once Sprint 6 enables it, the form already handles `source_type: "from_friend"` in the schema and Zod validation, but `friend_id` is always sent as `null`. Sprint 6 needs to add a friend-select component that sets `friend_id` to a valid user ID.

4. **No `tests/fixtures/sample-receipt.jpg`** — OCR test fixture not created since OCR testing was skipped.

**What Sprint 6 needs to know:**

- **Income "From Friend" dropdown stub location**: `frontend/app/dashboard/income/page.tsx`
  - Line 250: `friend_id: null` in `onSubmit()` — needs to be replaced with selected friend's ID
  - Line 482-491: Disabled button with TODO comment — needs to be replaced with a searchable `Select` component populated from `GET /api/v1/users/friends`
  - Line 496-500: Helper text "Friend selection will be available in Sprint 6" — can be removed
- The income form's `IncomeFormValues` type already includes `source_type: "salary" | "from_friend"`, so the schema is ready for real friend selection.

**What Sprint 9 needs to know:**

- **Presentational components for data-source swap** — all in `frontend/app/dashboard/page.tsx`:
  - `NetBalanceCard({ totalIncome: number, totalExpenses: number })` — currently receives client-computed sums
  - `TotalIncomeCard({ amount: number })` — currently receives `totalIncome` from client-side reduce
  - `TotalExpensesCard({ amount: number })` — currently receives `totalExpenses` from client-side reduce
  - `RecentActivityFeed({ expenses: Expense[], incomes: Income[] })` — currently receives full lists, merges + sorts client-side, takes last 10
- To swap to server-side analytics: replace the `useQuery` calls for `['expenses']` and `['income']` with calls to `/api/v1/analytics/*` endpoints, and pass the server-aggregated data to these same presentational components. The components are pure display — they don't compute anything from the arrays except sorting in `RecentActivityFeed`.
- **TanStack Query `['analytics']` key** is already being invalidated by all expense/income mutations in this sprint, so Sprint 9's analytics queries under this key (or sub-keys like `['analytics', 'net-balance']`) will automatically stay fresh.
