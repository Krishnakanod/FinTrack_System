# Spec-08 — Budgets + Notifications (Backend + Frontend)

**Companion sprint doc:** `.claude/sprints/Sprint-08.md`
**Prerequisite reading:** `.claude/sprints/Sprint-04.md` Handoff Notes / `Spec-04.md` for the exact `Expense` schema and `ExpenseCategory` enum to query against; `.claude/sprints/Sprint-06.md` Handoff Notes / `Spec-06.md` for the existing `Notification` model and `create_notification()` signature (this sprint completes that module, it does not start it).

---

## 1. Locked Contracts

### 1.1 `budgets` Collection — Beanie Document
```python
class Budget(Document):
    user_id: str                      # indexed
    category: ExpenseCategory         # reuses the exact enum from Spec-04 §1.1
    period: Literal["daily", "monthly", "quarterly", "yearly"]
    amount: Decimal                   # > 0
    alert_sent_80: bool = False
    alert_sent_100: bool = False
    period_anchor: str                # see §1.4 — locked field, NOT in original TRD.md schema, required for correct reset logic
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "budgets"
        # unique compound index: { user_id: 1, category: 1, period: 1 }
```
> **`period_anchor` is a new field beyond TRD.md §5.10's original listing**, added because correct alert-reset-on-new-period logic (see §1.4) cannot be implemented correctly with only the two boolean flags — you need to know WHICH period the flags currently apply to. This field is locked as part of this sprint's schema. Document this addition explicitly in Handoff Notes since it's a deviation from the original TRD.md table (an allowed, anticipated kind of deviation — TRD.md describes intent, this spec finalizes exact implementation).

### 1.2 Period Anchor Format (Locked)
The `period_anchor` string identifies which instance of the period the current alert flags belong to, computed in Asia/Kolkata timezone:
```
daily:     "2026-06-20"           (YYYY-MM-DD)
monthly:   "2026-06"              (YYYY-MM)
quarterly: "2026-Q2"              (YYYY-Q[1-4], Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
yearly:    "2026"                 (YYYY)
```

### 1.3 Period Date-Range Calculation (Locked, Asia/Kolkata Timezone)
```
daily:     [today 00:00:00 IST, today 23:59:59 IST]
monthly:   [1st of current month 00:00:00 IST, last day of current month 23:59:59 IST]
quarterly: [1st day of current quarter 00:00:00 IST, last day of current quarter 23:59:59 IST]
yearly:    [Jan 1 00:00:00 IST, Dec 31 23:59:59 IST]
```
This exact logic is needed in at least two places (budget spend calculation here, analytics period filters in Sprint 9) — strongly recommended (not mandated) to extract as `shared/period_utils.py` with a function like `get_period_range(period: str, reference_date: datetime) -> tuple[datetime, datetime]` and `get_period_anchor(period: str, reference_date: datetime) -> str`, so Sprint 9 can reuse rather than reimplement. If you choose not to extract it, document the duplication clearly in Handoff Notes so Sprint 9 knows there are two implementations to keep in sync.

### 1.4 Alert Reset Logic (Locked Behavior)
On every `evaluate_budgets()` run, for each budget:
```
current_anchor = get_period_anchor(budget.period, now_in_IST())
if current_anchor != budget.period_anchor:
    # A new period has begun since flags were last set
    budget.period_anchor = current_anchor
    budget.alert_sent_80 = False
    budget.alert_sent_100 = False
    save budget
    # Then proceed to evaluate spend for the NEW period as normal —
    # do not skip evaluation in the same run just because a reset happened
```
This reset check must run BEFORE the 80%/100% threshold check in the same evaluation pass, so a budget can both reset AND immediately re-trigger an alert in the same hourly run if spend in the new period is already high (e.g. a large expense logged right at the start of a new month).

**On budget creation:** `period_anchor` is set to `get_period_anchor(period, now)` at creation time, with both alert flags `False`.
**On budget update (amount change):** per Sprint-08.md Task 1, both alert flags reset to `False` — additionally, `period_anchor` should be re-set to the current anchor at update time (so an update doesn't accidentally suppress a legitimate immediate re-evaluation).

### 1.5 Budget Spend Calculation (Locked Query Shape)
```python
async def get_current_spend(user_id: str, category: ExpenseCategory, period: str) -> Decimal:
    start, end = get_period_range(period, now_in_IST())
    # MongoDB aggregation: $match user_id, category, date in [start, end] -> $sum amount
    # Returns Decimal('0.00') if no matching expenses, never None
```
**Locked: only `expenses` are counted toward budget spend** — group transaction splits where the user owes money are NOT included in budget spend calculations in v1 (this matches PRD scope; budgets are about the user's own logged expenses only — confirm this reading is correct and flag to Krishna if Sprint 7's Handoff Notes suggest otherwise, per `CLAUDE.md` Section 1, but as currently scoped this is the locked behavior).

### 1.6 Request/Response Schemas — Exact Shapes

**`POST /api/v1/budgets/`**
Request:
```json
{ "category": "Food", "period": "monthly", "amount": 5000.00 }
```
Response — `201 Created`:
```json
{
  "id": "string",
  "category": "Food",
  "period": "monthly",
  "amount": 5000.00,
  "alert_sent_80": false,
  "alert_sent_100": false,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```
> Note: `period_anchor` is an internal field — do NOT expose it in the API response. It's a backend implementation detail.

Response — `409 Conflict` (duplicate category+period for this user):
```json
{ "error": "BUDGET_ALREADY_EXISTS", "message": "A budget for this category and period already exists. Edit it instead.", "details": {} }
```

**`GET /api/v1/budgets/`** — `200` with `{ "items": [ <budget objects, same shape minus period_anchor> ] }`.

**`PUT /api/v1/budgets/{id}`**
Request: `{ "amount": 6000.00 }` (only `amount` is editable per PRD — category/period changes require delete+recreate, since they're part of the uniqueness key).
Response — `200 OK`: updated budget object, with `alert_sent_80`/`alert_sent_100` reset to `false` per §1.4.

**`DELETE /api/v1/budgets/{id}`** — `204 No Content`.

**`GET /api/v1/budgets/status`**
Response — `200 OK`:
```json
{
  "items": [
    {
      "id": "string",
      "category": "Food",
      "period": "monthly",
      "amount": 5000.00,
      "current_spend": 4200.00,
      "percentage_used": 84.0
    }
  ]
}
```
`percentage_used` is `round((current_spend / amount) * 100, 1)`, can exceed `100.0`.

**`GET /api/v1/notifications/?is_read=&limit=20&offset=0`**
Response — `200 OK`:
```json
{
  "items": [
    {
      "id": "string",
      "type": "budget_alert",
      "title": "Budget Alert: Food",
      "body": "You've spent 84% of your Food budget for this month.",
      "is_read": false,
      "metadata": {},
      "created_at": "ISO8601"
    }
  ],
  "total": 12,
  "unread_count": 5
}
```
> Locked: `unread_count` is always included in every list response regardless of the `is_read` filter applied, so the frontend bell badge can update from any call to this endpoint without a separate request.

**`PUT /api/v1/notifications/{id}/read`** — `200` with the updated notification object, or `404` if not found / not owned by the requesting user.

**`PUT /api/v1/notifications/read-all`** — `200` with `{ "updated_count": <int> }`.

### 1.7 Budget Alert Notification Content (Locked Format)
```
80% threshold:
  type: "budget_alert"
  title: f"Budget Alert: {category}"
  body: f"You've spent {percentage_used}% of your {category} budget for this {period}."

100%+ threshold:
  type: "budget_alert"
  title: f"Budget Exceeded: {category}"
  body: f"You've exceeded your {category} budget for this {period}. Current spend: ₹{current_spend} / ₹{amount}."
```
`metadata` for both: `{ "budget_id": "string", "threshold": "80" | "100" }`.

### 1.8 Email Alert Content
Must be sent via the email utility established in Sprint 2 (location per that sprint's Handoff Notes), using the SAME title/body content as §1.7 above, wrapped in the existing HTML template style. Subject line: same as `title` from §1.7.

### 1.9 Scheduler Interval (Locked Final State)
```python
@scheduler.scheduled_job("interval", hours=1)
```
Must be `hours=1` in the FINAL committed code. Temporary shorter intervals for local testing must be reverted before the sprint is marked done — this is explicitly checked in this sprint's Definition of Done.

---

## 2. Acceptance Scenarios

### Scenario 8.1 — Create budget, duplicate rejected
```gherkin
When I POST /api/v1/budgets/ with category="Food", period="monthly", amount=5000
Then I receive 201

When I POST the same category+period again with a different amount
Then I receive 409 with error="BUDGET_ALREADY_EXISTS"
And no second Budget document is created
```

### Scenario 8.2 — Budget status reflects real spend
```gherkin
Given a monthly Food budget of ₹5000 exists
And I have logged ₹4200 in Food expenses this calendar month (IST)
When I GET /api/v1/budgets/status
Then the Food entry shows current_spend=4200.00 and percentage_used=84.0
```

### Scenario 8.3 — 80% alert fires exactly once
```gherkin
Given a monthly Food budget of ₹1000, alert_sent_80=false
When my Food spend crosses ₹800 (80%) and evaluate_budgets() runs
Then alert_sent_80 becomes true
And exactly one email arrives
And exactly one Notification document is created with type="budget_alert", title containing "Budget Alert"

When evaluate_budgets() runs AGAIN (spend still >= 80%, nothing changed)
Then NO additional email or notification is sent (alert_sent_80 is already true)
```

### Scenario 8.4 — 100% alert fires independently of 80%
```gherkin
Given a monthly budget where alert_sent_80 is already true (from Scenario 8.3)
When my spend crosses 100% and evaluate_budgets() runs
Then alert_sent_100 becomes true
And a SEPARATE email/notification fires for the 100% threshold (different title: "Budget Exceeded")
```

### Scenario 8.5 — Alerts reset on new period
```gherkin
Given a monthly Food budget where alert_sent_80=true, alert_sent_100=true, period_anchor="2026-06"
When the system date crosses into July and evaluate_budgets() runs
Then period_anchor updates to "2026-07"
And alert_sent_80 and alert_sent_100 both reset to false
And current_spend for the new period is calculated fresh (starting from 0 for July)
And IF July spend already exceeds 80% in that same run (e.g. one large expense logged
  immediately), the 80% alert fires again in this same run (reset and re-evaluation
  happen in one pass, per §1.4)
```

### Scenario 8.6 — Editing a budget resets alert flags
```gherkin
Given a budget with alert_sent_80=true
When I PUT /api/v1/budgets/{id} with a new amount
Then the response shows alert_sent_80=false and alert_sent_100=false
```

### Scenario 8.7 — Notification list shows correct unread count
```gherkin
Given I have 5 unread and 7 read notifications
When I GET /api/v1/notifications/
Then total=12 and unread_count=5, regardless of any is_read filter applied
```

### Scenario 8.8 — Mark single notification as read
```gherkin
Given an unread notification with id "N1"
When I PUT /api/v1/notifications/N1/read
Then subsequent GET /api/v1/notifications/ shows N1 with is_read=true
And unread_count decreases by 1
```

### Scenario 8.9 — Mark all as read
```gherkin
Given I have 5 unread notifications
When I PUT /api/v1/notifications/read-all
Then I receive { "updated_count": 5 }
And a subsequent GET shows unread_count=0
```

### Scenario 8.10 — Frontend bell badge updates live
```gherkin
Given I am logged in with the dashboard open and WebSocket connected
When a budget alert fires server-side (e.g. triggered by an expense crossing 80%)
Then my notification bell's unread badge count increases WITHOUT me refreshing the page
  (driven by the NOTIFICATION WebSocket event, per Spec-06 §1.4 and §1.6)
```

---

## 3. Explicitly Out of Scope for This Sprint
- Including group transaction debts in budget spend calculations (locked decision in §1.5 — flag to Krishna if this seems wrong given Sprint 7's actual implementation, don't silently change it)
- Push notifications outside the browser (mobile push, etc.) — not in PRD scope

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Whether `shared/period_utils.py` was extracted (strongly recommended, see §1.3) — Sprint 9 needs to know either way
- Exact pagination defaults/behavior for `GET /api/v1/notifications/` beyond what's specified (e.g. max `limit` cap)

---

*End of Spec-08.md*
