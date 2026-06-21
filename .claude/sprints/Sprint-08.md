# Sprint 8 — Budgets + Notifications (Backend + Frontend)

**Layer:** Both
**Depends on:** Sprint 4 (expenses, for budget spend calculation), Sprint 6 (WebSocket, notification skeleton)
**Estimated files touched:** ~16-20

---

## Context to Read First

1. `docs/PRD.md` — Section 3.6 (US-11 Set Budget Goal)
2. `docs/TRD.md` — Section 5.10 (budgets schema), Section 5.11 (notifications schema), Section 6.7 (Budgets API), Section 6.9 (Notifications API), Section 9 (full Notification & Budget Cron Architecture — read entirely, including the exact APScheduler code sample)
3. `docs/App-Flow.md` — Section 9 (Budget Goal Creation & Alert flow), Section 11 (Notifications Bell flow)
4. **Read `.claude/sprints/Sprint-06.md` → Handoff Notes** for the existing `modules/notifications/models.py` and `service.py` (you're completing this module, not starting it from scratch — the `create_notification()` function already exists and works).
5. **Read `.claude/sprints/Sprint-04.md` → Handoff Notes** for the exact Expense schema/category enum to query against for budget spend calculation.

---

## Goal

Build the complete Budgets module (CRUD + hourly APScheduler evaluation job + email/in-app alerts) and complete the Notifications module (list/mark-read endpoints + frontend bell dropdown). Both are grouped since Notifications is a small surface that's mostly "called by other modules" and budgets is the main consumer of it in this sprint.

---

## Tasks — Backend

### 1. Budgets Module

**Models** (`modules/budgets/models.py`) — Beanie `Budget` document per `TRD.md` §5.10. Register in `core/database.py`.

**Schemas** (`modules/budgets/schemas.py`) — `BudgetCreate` (category, period, amount), `BudgetUpdate`, `BudgetResponse`, `BudgetStatusResponse` (budget details + current_spend + percentage_used).
- Validation: one budget per `(user_id, category, period)` combination — editing replaces, don't allow duplicates (enforce via the unique compound index from `TRD.md` §5.10, catch the duplicate-key error and convert to a clean 409).

**Service** (`modules/budgets/service.py`):
- `create_budget(user_id, data: BudgetCreate) -> Budget`
- `list_budgets(user_id) -> list[BudgetResponse]`
- `update_budget(user_id, budget_id, data) -> BudgetResponse` (reset `alert_sent_80`/`alert_sent_100` to `False` on update, since the budget amount changed)
- `delete_budget(user_id, budget_id) -> None`
- `get_budget_status(user_id) -> list[BudgetStatusResponse]`:
  - For each active budget, compute current period's spend by querying `expenses` collection filtered by `user_id`, `category`, and a date range derived from `period` (daily = today, monthly = current calendar month, quarterly = current quarter, yearly = current year — all in Asia/Kolkata timezone per `PRD.md` §1.1)
  - Return `current_spend`, `percentage_used = current_spend / amount * 100`

**Scheduler** (`modules/budgets/scheduler.py`) — implement **exactly** per `TRD.md` §9.3:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

@scheduler.scheduled_job("interval", hours=1)
async def evaluate_budgets():
    # fetch all budgets, compute spend, send alerts at 80%/100% thresholds,
    # mark alert_sent_80/100 flags so alerts don't repeat
    ...
```
- Register `scheduler.start()` in `main.py`'s startup event (per `TRD.md` §9.3's exact snippet).
- **Period reset logic:** when a new period starts (e.g., a new month begins for a monthly budget), `alert_sent_80`/`alert_sent_100` need to reset to `False` so alerts can fire again. Implement this check inside `evaluate_budgets()` — e.g., track `last_reset_at` or simply recompute "is this still the same period as last evaluation" each run. Document your exact approach in Handoff Notes since this is easy to get subtly wrong.
- For local testing, **temporarily** change the interval to `seconds=30` or similar so you don't have to wait an hour to verify — but **revert to `hours=1` before finishing the sprint.**

**Email Alert** — reuse the email utility from Sprint 2 (`core/email.py` or wherever it landed per Sprint 2's Handoff Notes); add a budget-alert-specific HTML template ("You've spent 80% of your Food budget for June" / "You've exceeded your Food budget for June").

**Router** (`modules/budgets/router.py`) — all 5 endpoints from `TRD.md` §6.7. Register in `main.py`.

### 2. Notifications Module — Complete It

(Models and `create_notification()` already exist from Sprint 6 — read its Handoff Notes first.)

**Schemas** (`modules/notifications/schemas.py`) — `NotificationResponse`, paginated list wrapper.

**Service additions** (`modules/notifications/service.py`):
- `list_notifications(user_id, is_read=None, limit=20, offset=0) -> list[NotificationResponse]`
- `mark_as_read(user_id, notification_id) -> None`
- `mark_all_as_read(user_id) -> None`

**Router** (`modules/notifications/router.py`) — the 3 endpoints from `TRD.md` §6.9 (`GET /`, `PUT /{id}/read`, `PUT /read-all`). Register in `main.py`.

### 3. Backend Verification
```bash
TOKEN="<token>"
curl -X POST http://localhost:8000/api/v1/budgets/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"Food","period":"monthly","amount":5000}'

curl http://localhost:8000/api/v1/budgets/status -H "Authorization: Bearer $TOKEN"

# Add expenses until you cross 80%/100% of the Food budget, then wait for (or manually
# trigger, with the temporary short interval) the scheduler, and confirm:
# 1. Email arrives
# 2. GET /api/v1/notifications shows the new notification
# 3. If connected via WebSocket, the event arrives live
curl http://localhost:8000/api/v1/notifications -H "Authorization: Bearer $TOKEN"
```

---

## Tasks — Frontend

### 4. API Functions
- `lib/api/budgets.ts` — `createBudget()`, `listBudgets()`, `updateBudget()`, `deleteBudget()`, `getBudgetStatus()`.
- `lib/api/notifications.ts` — `listNotifications()`, `markAsRead()`, `markAllAsRead()`.

### 5. Budget Page (`app/dashboard/budget/page.tsx`)
- List of budgets as cards with progress bars (color-coded: green < 80%, yellow 80-99%, red ≥100%), showing category, period, amount, current spend.
- "Set Budget" form: Category dropdown, Period dropdown, Amount input.
- Edit/Delete per budget.

### 6. Notification Bell (Header Component, started in Sprint 3 as a placeholder)
- Replace the Sprint 3 placeholder bell icon with a real dropdown:
  - Unread count badge (subscribe to websocket-store for live `NOTIFICATION` events to update the badge instantly, in addition to the initial fetch via `listNotifications()`)
  - Dropdown list: recent notifications, click to mark read, "Mark all read" button
  - Per `App-Flow.md` §11

### 7. Playwright Tests
- `tests/budget.spec.ts` — create budget, verify progress bar reflects existing expenses, edit, delete.
- `tests/notifications.spec.ts` — seed a notification via direct API call, verify it appears in the bell dropdown, mark as read, verify badge count decreases.

---

## Definition of Done

- [ ] Budget CRUD works via curl and UI
- [ ] Budget status correctly computes spend per period (test all 4 period types: daily/monthly/quarterly/yearly)
- [ ] APScheduler job runs hourly (confirmed working with a temporarily shortened interval, then reverted to `hours=1` before sprint completion)
- [ ] 80% and 100% alerts fire exactly once per period (not repeatedly), and reset correctly when a new period begins
- [ ] Email alerts arrive for both thresholds
- [ ] In-app notification + WebSocket push work for budget alerts
- [ ] Notification bell shows live unread count and dropdown list
- [ ] Mark as read / mark all as read work
- [ ] `tests/budget.spec.ts` and `tests/notifications.spec.ts` pass

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 8 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- Exact period-reset logic for alert_sent_80/100 flags: [describe]
- Final scheduler interval confirmed as hours=1: [confirm yes]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 9 needs to know:**
- Budget category enum is the same shared ExpenseCategory from shared/enums.py
  (Sprint 4) — Analytics should reuse this same enum for consistency
- Notification types in use so far: group_transaction, budget_alert — Analytics/
  Reports don't need to touch notifications, just confirming no overlap in scope
```
