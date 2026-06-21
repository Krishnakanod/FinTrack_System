# Spec-09 — Analytics & Reports (Backend + Frontend)

**Companion sprint doc:** `.claude/sprints/Sprint-09.md`
**Prerequisite reading:** `.claude/sprints/Sprint-07.md` Handoff Notes / `Spec-07.md` §1.3 for the locked balance convention and final `group_transactions` schema; `.claude/sprints/Sprint-08.md` Handoff Notes / `Spec-08.md` §1.3 for whether `shared/period_utils.py` exists; `.claude/sprints/Sprint-05.md` Handoff Notes / `Spec-05.md` for the extracted dashboard presentational component names.

---

## 1. Locked Contracts

### 1.1 Period Range Calculation — Reuse, Don't Reimplement
If Sprint 8's Handoff Notes confirm `shared/period_utils.py` exists with `get_period_range(period, reference_date)`, **this sprint MUST import and reuse it**, not write a second implementation. If Sprint 8 did NOT extract it, this sprint should extract it now retroactively (move Sprint 8's inline logic into `shared/period_utils.py`, update Sprint 8's budget module to import it too) rather than write a third inconsistent copy — and note this refactor explicitly in this sprint's Handoff Notes. Either way, **only one implementation of period-range math should exist in the codebase by the end of this sprint.**

Period values for analytics endpoints (locked, note this set is NOT identical to Sprint 8's budget periods):
```
"daily" | "weekly" | "monthly" | "quarterly"
```
> Note: analytics periods include `"weekly"` but NOT `"yearly"`, while budget periods (Spec-08 §1.1) include `"yearly"` but NOT `"weekly"`. This asymmetry is intentional per the original PRD/TRD scope (`TRD.md` §6.8 vs §6.7) — do not try to "fix" this inconsistency by unifying the two enums; they are deliberately different feature surfaces with different period options. `get_period_range` must support both `"weekly"` (Mon-Sun of the current week, IST) and `"yearly"` as general-purpose options in the shared utility even though each individual feature only uses a subset.

`"weekly"` range definition (locked, new — not previously specified): `[Monday 00:00:00 IST of the current week, Sunday 23:59:59 IST of the current week]`.

### 1.2 Request/Response Schemas — Exact Shapes

**`GET /api/v1/analytics/expenses?period=monthly`**
Response — `200 OK`:
```json
{
  "period": "monthly",
  "range": { "start": "2026-06-01", "end": "2026-06-30" },
  "breakdown": [
    { "category": "Food", "total_amount": 4200.00, "percentage": 45.2 },
    { "category": "Transport", "total_amount": 2100.00, "percentage": 22.6 }
  ],
  "total": 9300.00
}
```
**Locked:** `breakdown` only includes categories with `total_amount > 0` (don't list all 7 `ExpenseCategory` values if some have zero spend — keeps the chart clean). Sorted by `total_amount` descending. `percentage` is `round((category_total / total) * 100, 1)`; if `total == 0`, `breakdown` is an empty array and `total` is `0.00` (no division-by-zero error).

**`GET /api/v1/analytics/income?period=monthly`**
Same shape as expenses, but `breakdown` is grouped by `source_type` (`"salary"` | `"from_friend"`) instead of category:
```json
{
  "period": "monthly",
  "range": { "start": "2026-06-01", "end": "2026-06-30" },
  "breakdown": [
    { "source_type": "salary", "total_amount": 50000.00, "percentage": 96.2 },
    { "source_type": "from_friend", "total_amount": 2000.00, "percentage": 3.8 }
  ],
  "total": 52000.00
}
```

**`GET /api/v1/analytics/net-balance`**
**Locked scope decision:** all-time (not period-scoped), matching what Sprint 5's dashboard widget already computed client-side (per PRD US-12's dashboard usage context — this endpoint exists specifically to replace that client-side computation with an equivalent server-side one, so the numbers must match what Sprint 5 was already showing, just computed correctly server-side).
Response — `200 OK`:
```json
{ "total_income": 52000.00, "total_expense": 9300.00, "net_balance": 42700.00 }
```
`total_expense` here is the user's own logged `expenses` total only (NOT including group transaction debts) — same scoping rule as Spec-08 §1.5's budget spend calculation, for consistency.

**`GET /api/v1/analytics/recent-activity?limit=10`**
Response — `200 OK`:
```json
{
  "items": [
    {
      "type": "expense",
      "id": "string",
      "description": "Lunch",
      "amount": 250.00,
      "date": "ISO8601",
      "direction": "out"
    },
    {
      "type": "income",
      "id": "string",
      "description": "June salary",
      "amount": 50000.00,
      "date": "ISO8601",
      "direction": "in"
    },
    {
      "type": "group_transaction",
      "id": "string",
      "description": "Dinner",
      "amount": 300.00,
      "date": "ISO8601",
      "direction": "out",
      "group_id": "string",
      "group_name": "Trip to Goa"
    }
  ]
}
```
**Locked merge/sort rule:** combine top candidates from `expenses` (all are `direction: "out"`), `income` (all are `direction: "in"`), and `group_transactions` WHERE the requesting user appears in `splits` (i.e., they owe money on it — `direction: "out"`) OR they are `paid_by` (they fronted money for others — for `paid_by` entries, `direction` is `"in"` from a cash-flow-out-then-reimbursed perspective... **this is ambiguous, see Open Implementation Choice below — for THIS sprint, lock it as: group transactions where the user is `paid_by` are EXCLUDED from recent activity entirely** (only their OWN expenses, income, and debts-they-owe from group splits appear) to avoid the direction ambiguity. Sort combined results by `date` descending, return top `limit`.

**`POST /api/v1/reports/download`**
Request:
```json
{ "start_date": "2026-01-01", "end_date": "2026-06-30", "format": "pdf" }
```
`format` is `"pdf"` or `"excel"` (locked literal values, lowercase).
Response — binary file stream:
```
Content-Type: application/pdf  (or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet for excel)
Content-Disposition: attachment; filename="fintrack-report-2026-01-01-to-2026-06-30.pdf"
```
Response — `422` if `start_date > end_date`:
```json
{ "error": "INVALID_DATE_RANGE", "message": "Start date must be before end date.", "details": {} }
```

### 1.3 Report Content Scope (Locked)
Both PDF and Excel reports must include, for the given date range:
- All of the user's own `expenses`
- All of the user's own `income`
- All `group_transactions` where the user is `paid_by` OR appears in `splits` (unlike recent-activity's exclusion above, reports include BOTH directions since a report is meant to be a complete financial record, not a simplified feed — label clearly which role the user played in each row, e.g. a "Role" column: "Paid" vs "Owed")
- A totals/summary section: total expenses, total income, net balance, for the selected range only (not all-time)

### 1.4 PDF Report Structure (Locked Sections, Styling Your Choice)
```
Header: "FinTrack Financial Report" + date range + generated-on timestamp
Section 1: Expenses table (Date, Category, Description, Amount, Payment Type)
Section 2: Income table (Date, Source, Description, Amount, Payment Type)
Section 3: Group Transactions table (Date, Group, Description, Role [Paid/Owed], Amount)
Footer: Summary — Total Income, Total Expenses, Net Balance for the range
```

### 1.5 Excel Report Structure (Locked Sheets)
```
Sheet "Expenses": Date | Category | Description | Amount | Payment Type
Sheet "Income": Date | Source Type | Description | Amount | Payment Type
Sheet "Group Transactions": Date | Group | Description | Role | Amount
```
Each sheet has a header row (bold, locked requirement) and a totals row at the bottom (locked requirement) summing the Amount column.

### 1.6 Frontend API Function Signatures (`lib/api/analytics.ts`)
```typescript
getExpenseBreakdown(period: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Promise<BreakdownResponse>
getIncomeBreakdown(period: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Promise<BreakdownResponse>
getNetBalance(): Promise<{ total_income: number; total_expense: number; net_balance: number }>
getRecentActivity(limit?: number): Promise<{ items: ActivityItem[] }>
downloadReport(data: { start_date: string; end_date: string; format: 'pdf' | 'excel' }): Promise<void>
  // handles the binary blob response and triggers a browser file download directly;
  // does not return the blob to the caller
```

### 1.7 TanStack Query Keys (Locked, Replacing Sprint 5's Placeholder)
```typescript
['analytics', 'expenses', period]
['analytics', 'income', period]
['analytics', 'net-balance']
['analytics', 'recent-activity', limit]
```
These specific sub-keys are what Sprint 5's broad `['analytics']` invalidation (Spec-05 §1.3) was anticipating — since TanStack Query invalidation matches by key prefix, Sprint 5's existing `queryClient.invalidateQueries({ queryKey: ['analytics'] })` calls will correctly invalidate all of these without modification. Confirm this works as expected; if Sprint 5 implemented invalidation differently (exact-match instead of prefix-based), flag it and fix Sprint 5's invalidation calls to use prefix matching.

### 1.8 Dashboard Overview Swap (Locked Requirement)
`app/dashboard/page.tsx` must be updated to call `getNetBalance()` and `getRecentActivity(10)` instead of Sprint 5's client-side merge-and-compute logic. The presentational components Sprint 5 extracted (exact names per Sprint 5's Handoff Notes) must be reused as-is — this is a data-source swap, not a component rewrite. If Sprint 5 did NOT actually extract clean presentational components (despite being asked to), do the minimal refactor needed now rather than leaving dead client-side computation code alongside the new server calls — document this cleanup in Handoff Notes.

---

## 2. Acceptance Scenarios

### Scenario 9.1 — Expense breakdown excludes zero-spend categories
```gherkin
Given I have expenses only in Food and Transport this month (no Shopping, Entertainment, etc.)
When I GET /api/v1/analytics/expenses?period=monthly
Then breakdown contains exactly 2 entries (Food, Transport)
And percentages sum to approximately 100.0 (within rounding tolerance)
```

### Scenario 9.2 — Zero-spend period returns empty breakdown safely
```gherkin
Given I have no expenses at all this month
When I GET /api/v1/analytics/expenses?period=monthly
Then I receive 200 with breakdown=[] and total=0.00
(no 500 error from division by zero)
```

### Scenario 9.3 — Net balance matches Sprint 5's prior client-computed value
```gherkin
Given a fixed set of seeded expenses and income for a test user
When I GET /api/v1/analytics/net-balance
Then total_income, total_expense, and net_balance exactly match what summing the
  raw expense/income lists would produce (i.e., this endpoint is a correctness
  upgrade, not a scope change, from Sprint 5's client-side math)
```

### Scenario 9.4 — Recent activity merges and sorts across three sources
```gherkin
Given I have expenses, income, and group transactions (where I owe money) on different dates
When I GET /api/v1/analytics/recent-activity?limit=10
Then the items array is sorted by date descending across ALL three types combined
And group transactions where I am paid_by do NOT appear (per locked §1.2 exclusion)
```

### Scenario 9.5 — Period filter changes displayed chart data
```gherkin
Given I am on /dashboard/analytics with period="monthly" selected
When I switch the period selector to "weekly"
Then the chart re-renders with data scoped to the current week only (Mon-Sun IST)
And the API call uses period=weekly
```

### Scenario 9.6 — PDF report downloads with correct structure
```gherkin
Given I have expenses, income, and group transactions in a given date range
When I POST /api/v1/reports/download with that range and format="pdf"
Then I receive a valid PDF binary response with the correct Content-Disposition filename
And opening the PDF shows all three sections (§1.4) plus a totals footer matching the
  range's actual data
```

### Scenario 9.7 — Excel report has three correctly named sheets
```gherkin
When I POST /api/v1/reports/download with format="excel"
Then the resulting .xlsx file has exactly 3 sheets named "Expenses", "Income",
  "Group Transactions" (exact names, case-sensitive)
And each sheet has a bold header row and a totals row
```

### Scenario 9.8 — Invalid date range rejected
```gherkin
When I POST /api/v1/reports/download with start_date="2026-06-30" and end_date="2026-01-01"
Then I receive 422 with error="INVALID_DATE_RANGE"
```

### Scenario 9.9 — Frontend download triggers browser file save
```gherkin
Given I am on /dashboard/analytics
When I open the Download Report dialog, select a date range and format, and confirm
Then a file download is triggered in the browser (verifiable via Playwright's download event)
And no JSON error is shown for a valid range
```

### Scenario 9.10 — Dashboard overview now uses real backend data
```gherkin
Given I am on /dashboard (the overview page, not /dashboard/analytics)
When the page loads
Then the Net Balance card's value comes from GET /api/v1/analytics/net-balance
  (verifiable by checking the network request, not just visually matching the number)
And the Recent Activity feed's data comes from GET /api/v1/analytics/recent-activity
```

---

## 3. Explicitly Out of Scope for This Sprint
- Any change to how group transactions where the user is `paid_by` are displayed elsewhere in the app (only this sprint's `recent-activity` endpoint excludes them, per §1.2 — the Balances page and Group transaction list, built in Sprint 7, are unaffected)
- Custom/saved report templates, scheduled report emails — not in PRD scope

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Chart library specifics (Recharts component choices: Pie vs Bar for category breakdown, Line vs Bar for trends) — PRD/TRD leave exact chart type unspecified
- Exact PDF/Excel visual styling beyond the locked structural requirements in §1.4/§1.5
- **Flag clearly:** the `recent-activity` `paid_by`-exclusion decision in §1.2 was made to resolve an ambiguity in the original docs — if this doesn't match Krishna's mental model of "recent activity," note it prominently in Handoff Notes as a decision Krishna may want to revisit, since it's a product-judgment call this spec made unilaterally to keep the sprint shippable, not a deeply considered design decision

---

*End of Spec-09.md*
