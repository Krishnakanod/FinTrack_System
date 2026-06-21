# Sprint 9 — Analytics & Reports (Backend + Frontend)

**Layer:** Both
**Depends on:** Sprint 4 (expenses, income), Sprint 7 (group transactions, balances)
**Estimated files touched:** ~16-18

---

## Context to Read First

1. `docs/PRD.md` — Section 3.7 (US-12 Analytics Dashboard, US-13 Download Report)
2. `docs/TRD.md` — Section 6.8 (Analytics/Reports API)
3. `docs/App-Flow.md` — Section 10 (Analytics & Report Download flow)
4. **Read `.claude/sprints/Sprint-07.md` → Handoff Notes** for the final `group_transactions` schema and balance storage convention — Reports needs to read this correctly.
5. **Read `.claude/sprints/Sprint-05.md` → Handoff Notes** for which dashboard components were extracted as presentational (net balance card, recent activity feed) so you can swap their data source cleanly instead of rebuilding them.
6. **Read `.claude/sprints/Sprint-04.md` → Handoff Notes** for the exact Expense/Income schemas to aggregate.

---

## Goal

Build the Analytics module: category/period breakdowns, net balance, recent activity (replacing Sprint 5's client-side computed versions with real backend aggregations), and downloadable PDF/Excel reports. Build the matching frontend with Recharts visualizations.

---

## Tasks — Backend

### 1. Schemas (`modules/analytics/schemas.py`)
- `CategoryBreakdownResponse` (list of `{category, total_amount, percentage}`)
- `PeriodComparisonResponse` (list of `{period_label, income, expense}`, for line/bar chart over time)
- `NetBalanceResponse` (total_income, total_expense, net_balance)
- `RecentActivityItem` (type: "expense"|"income"|"group_transaction", description, amount, date, direction)
- `ReportDownloadRequest` (start_date, end_date, format: "pdf"|"excel")

### 2. Service (`modules/analytics/service.py`)
- `get_expense_breakdown(user_id, period: str) -> CategoryBreakdownResponse`:
  - `period` one of daily/weekly/monthly/quarterly — compute date range in Asia/Kolkata timezone (reuse the same period-range logic pattern from Sprint 8's budget status calc — consider extracting a shared `shared/period_utils.py` helper if not already done, to avoid duplicating this logic a third time)
  - MongoDB aggregation pipeline: `$match` by user_id + date range, `$group` by category, `$sum` amount
- `get_income_breakdown(user_id, period: str) -> ...` — similar aggregation on `income` collection
- `get_net_balance(user_id) -> NetBalanceResponse` — sum of all expenses vs all income, all-time (or consider a period param — check PRD US-12 wording; if ambiguous, implement all-time as the default per dashboard usage from Sprint 5)
- `get_recent_activity(user_id, limit=10) -> list[RecentActivityItem]`:
  - Merge most recent N records across `expenses`, `income`, and `group_transactions` (where user is involved), sort by date descending, return top `limit`
- `generate_report_data(user_id, start_date, end_date) -> dict`:
  - Pulls all expenses, income, and group transactions (where user is `paid_by` or in `splits`) within the date range
  - Computes totals and net balance for that range
  - This shared data-gathering function feeds both PDF and Excel generators below

### 3. PDF Report (`modules/analytics/pdf_report.py`)
- Use ReportLab per `TRD.md` §2 and §10.4 deps.
- Layout: header (FinTrack branding + date range), table of expenses, table of income, table of group transactions, totals row, footer.
- Return as bytes for the router to stream as a file download.

### 4. Excel Report (`modules/analytics/excel_report.py`)
- Use openpyxl.
- 3 sheets: "Expenses", "Income", "Group Transactions" — each with proper headers and a totals row.
- Return as bytes.

### 5. Router (`modules/analytics/router.py`)
All endpoints from `TRD.md` §6.8:
```
GET  /api/v1/analytics/expenses?period=
GET  /api/v1/analytics/income?period=
GET  /api/v1/analytics/net-balance
GET  /api/v1/analytics/recent-activity?limit=10
POST /api/v1/reports/download
```
- The download endpoint returns the file with `Content-Disposition: attachment; filename="fintrack-report-{start}-{end}.pdf"` (or `.xlsx`) and the correct `media_type`.
- Register router in `main.py`.

### 6. Backend Verification
```bash
TOKEN="<token>"
curl "http://localhost:8000/api/v1/analytics/expenses?period=monthly" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:8000/api/v1/analytics/recent-activity?limit=10" -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:8000/api/v1/reports/download \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"start_date":"2026-01-01","end_date":"2026-06-30","format":"pdf"}' \
  --output report.pdf
# Open report.pdf and visually confirm it's well-formed
```

---

## Tasks — Frontend

### 7. API Functions (`lib/api/analytics.ts`)
`getExpenseBreakdown()`, `getIncomeBreakdown()`, `getNetBalance()`, `getRecentActivity()`, `downloadReport()` (handles binary blob response, triggers browser download via a temporary `<a>` element).

### 8. Analytics Page (`app/dashboard/analytics/page.tsx`)
- Period selector (Daily/Weekly/Monthly/Quarterly) driving all queries via TanStack Query.
- Recharts pie or bar chart: expense breakdown by category.
- Recharts line or bar chart: income vs expense over time.
- Net balance summary card.
- Recent activity feed (replacing Sprint 5's client-merged version).
- "Download Report" button → dialog with start date, end date, format radio (PDF/Excel) → calls `downloadReport()`.

### 9. Update Dashboard Overview (`app/dashboard/page.tsx`)
- Swap Sprint 5's client-side-computed net balance and recent activity for the real `/analytics/net-balance` and `/analytics/recent-activity` endpoints, using the presentational components already extracted in Sprint 5 (per its Handoff Notes) — this should be a data-source swap, not a UI rebuild.

### 10. Playwright Tests (`tests/analytics.spec.ts`)
- Verify charts render with seeded data (create a few expenses/income via API in `beforeAll`, then check chart elements/labels are present).
- Period filter changes the displayed data.
- Report download triggers a file download (Playwright can assert on the download event).

---

## Definition of Done

- [ ] All analytics endpoints return correct aggregated data for all 4 period types
- [ ] Recent activity correctly merges and sorts expenses, income, and group transactions
- [ ] PDF report generates correctly, opens without errors, contains accurate totals
- [ ] Excel report generates correctly with 3 properly formatted sheets
- [ ] Analytics page renders charts correctly and responds to period filter changes
- [ ] Dashboard overview now uses real backend aggregation instead of Sprint 5's client-side computation
- [ ] Report download works from the UI (file actually downloads)
- [ ] `tests/analytics.spec.ts` passes

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 9 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., net balance: all-time vs period-scoped — which was implemented]
- [e.g., whether shared/period_utils.py was created to dedupe period-range logic
  with Sprint 8's budget module]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 10 needs to know:**
- Any known data edge cases found during this sprint's testing (e.g., users with
  zero transactions, very large date ranges) that the E2E pass should specifically
  re-verify in the deployed environment
```
