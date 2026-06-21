# FinTrack — Application Flow Document (App-Flow.md)

**Companion to:** `PRD.md`, `TRD.md`
**Purpose:** Visual/textual walkthrough of every major user journey and how data moves through the modular monolith. Read this when implementing any frontend page so you know what the backend expects/returns at each step.

---

## 1. High-Level Navigation Map

```
/ (landing/redirect)
│
├── /login
├── /signup
├── /forgot-password
│
└── /dashboard (protected — requires valid JWT)
    ├── /dashboard                  → overview: net balance, recent activity, quick-add
    ├── /expenses                   → list + add (manual/OCR) + edit/delete
    ├── /income                     → list + add + edit/delete
    ├── /friends                    → search, add, list
    ├── /groups                     → list groups
    │   └── /groups/[id]            → group detail: members, transactions, add transaction
    ├── /balances                   → who-owes-whom summary
    ├── /budget                     → CRUD budgets + progress bars
    ├── /analytics                  → charts + report download
    └── /notifications              → notification bell dropdown / full list
```

---

## 2. Flow: Signup → First Login

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  /signup │────▶│ POST /auth/ │────▶│ User enters  │────▶│ POST      │
│  form    │     │  signup     │     │ 6-digit OTP  │     │ /auth/    │
└──────────┘     └─────────────┘     └──────────────┘     │verify-otp │
                        │                                  └─────┬─────┘
                        ▼                                        │
                 OTP emailed via                                 ▼
                 Gmail SMTP                              User created in
                                                           `users` collection
                                                           is_verified=true
                                                                  │
                                                                  ▼
                                                          JWT issued, redirect
                                                          to /dashboard
```

**Backend sequence (auth module):**
1. `POST /api/v1/auth/signup` → validates email uniqueness → creates unverified shell record? **No** — original design creates the OTP record first, user record only on verify. Decision: store pending signup data (name, email, password_hash) in the `otps` document's metadata until verified, OR create `users` doc with `is_verified=false` immediately. **Recommended:** create `users` doc immediately with `is_verified=false` (simpler, avoids losing data if OTP step is abandoned — visible as "incomplete signups" if needed later).
2. Generate 6-digit OTP, hash it, store in `otps` collection with `purpose=signup`, `expires_at = now+10min`.
3. Send OTP via email (Gmail SMTP).
4. `POST /api/v1/auth/verify-otp` → look up OTP by email+purpose, compare hash, check expiry.
5. On success: set `users.is_verified=true`, delete OTP doc, issue JWT access+refresh tokens.
6. Frontend stores access token in Zustand, refresh token arrives as httpOnly cookie, redirect to `/dashboard`.

---

## 3. Flow: Login

```
/login form ──▶ POST /api/v1/auth/login ──▶ Validate password (bcrypt)
                                                    │
                                          ┌─────────┴─────────┐
                                          ▼                   ▼
                                     Success              Failure
                                          │                   │
                              Issue JWT (access+refresh)  Increment fail
                              Set refresh as httpOnly      counter, lock
                              cookie                       after 3 (5 min)
                                          │
                                          ▼
                              Redirect to /dashboard
                              Open WebSocket connection
                              wss://.../ws/{user_id}?token=<access_token>
```

After login, the frontend immediately opens the WebSocket connection (see `lib/websocket.ts` hook) so real-time events work from the moment the dashboard loads.

---

## 4. Flow: Add Expense (Manual)

```
/expenses → "Add Expense" button → Modal/Drawer form
   Category | Description | Amount | Date | Payment Type
                       │
                       ▼
         POST /api/v1/expenses/
                       │
        ┌──────────────┴──────────────┐
        ▼                              ▼
  expenses/service.py            Validation error
  saves to `expenses`            (e.g. amount <= 0)
  collection                     → 422 returned,
        │                          form shows inline error
        ▼
  Returns created expense
        │
        ▼
  Frontend: TanStack Query
  invalidates ['expenses'] and
  ['analytics'] query keys
        │
        ▼
  List + dashboard totals
  update immediately (no
  WebSocket needed — this is
  the user's own action)
```

---

## 5. Flow: Add Expense (OCR / Receipt Upload)

```
/expenses → "Scan Receipt" → file picker (JPG/PNG, max 5MB)
                       │
                       ▼
         Frontend reads file as base64
                       │
                       ▼
  POST /api/v1/expenses/ocr { image_base64, mime_type }
                       │
                       ▼
        expenses/ocr.py calls Google
        Cloud Vision (text_detection)
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
  Text extracted successfully     No text detected
        │                               │
        ▼                               ▼
  Parse amount/date/merchant      Return empty result +
  via regex + dateutil            toast: "Couldn't read
        │                         receipt, please fill
        ▼                         manually"
  Return { amount, date,
  merchant, raw_text,
  confidence_score }
        │
        ▼
  Frontend pre-fills Add Expense
  form (all fields still editable)
        │
        ▼
  If confidence_score < threshold,
  show yellow warning banner:
  "Please double-check the
  extracted values"
        │
        ▼
  User reviews/edits → clicks
  "Confirm & Save"
        │
        ▼
  POST /api/v1/expenses/ocr/confirm
  (same payload shape as manual
  add, plus source="ocr" and
  ocr_confidence)
        │
        ▼
  Saved to `expenses` collection,
  same as manual flow from here
```

---

## 6. Flow: Add Income

```
/income → "Add Income" → form
   Source Type (Salary | From Friend)
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
  Salary selected                From Friend selected
  (friend_id field hidden)        │
                                   ▼
                          GET /api/v1/users/friends
                          populates searchable dropdown
                       │
                       ▼
       Description | Date | Amount | Payment Type
                       │
                       ▼
         POST /api/v1/income/
                       │
                       ▼
       income/service.py saves to
       `income` collection
                       │
                       ▼
       TanStack Query invalidates
       ['income'], ['analytics']
       → dashboard net balance
       updates immediately
```

---

## 7. Flow: Add Friend

```
/friends → search bar → GET /api/v1/users/search?email=...
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
  User found                      Not found
        │                               │
        ▼                               ▼
  "Add Friend" button shown        "No user found with
        │                          this email" message
        ▼
  POST /api/v1/users/friends
  { friend_user_id }
        │
        ▼
  users/service.py creates
  `friendships` doc
  status="accepted" (no approval
  flow in v1 — direct add, per
  original simple design)
        │
        ▼
  Friend appears in /friends list
  and becomes selectable in:
   - Income "From Friend" dropdown
   - Group member selection
```

---

## 8. Flow: Create Group → Add Group Transaction → Real-Time Split (CORE FLOW)

This is the most complex flow in the app — it touches groups, balances, notifications, and websockets in one request.

### 8.1 Create Group
```
/groups → "Create Group" → Name, Description, Select Members (from friends)
                       │
                       ▼
         POST /api/v1/groups/groups
                       │
                       ▼
       groups/service.py creates
       `groups` doc, creator auto-
       added to `members` array
                       │
                       ▼
       Redirect to /groups/[id]
```

### 8.2 Add Group Transaction (the real-time core flow)
```
/groups/[id] → "Add Transaction" → form:
   Amount | Description | Paid By (dropdown of members)
   | Split Among (multi-select, defaults to all members)
   | Split Type: Equal | Custom
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
   Split Type = Equal              Split Type = Custom
   amount / N members auto-        User manually enters
   calculated, shown read-only     amount per selected
                                    member; frontend
                                    validates sum == total
                       │
                       ▼
   POST /api/v1/groups/groups/{id}/transactions
   {
     amount, description, paid_by,
     split_type, splits: [{user_id, amount_owed}, ...]
   }
                       │
                       ▼
   ══════════ groups/service.py (single transaction) ══════════
   1. Validate: sum(splits.amount_owed) == amount
   2. Save `group_transactions` doc
   3. For each split where user_id != paid_by:
        Update `balances` collection:
        balances.find_one_and_update(
          { user_id: split.user_id, counterpart_id: paid_by },
          { $inc: { net_amount: split.amount_owed } },
          upsert=True
        )
        (and the inverse record for paid_by → user_id, net_amount: -amount_owed,
         OR compute it on read — implementer's choice, document whichever
         is chosen in code comments)
   4. For each affected member (all of splits + paid_by, excluding the
      actor who submitted the request):
        a. notifications.service.create_notification(
             user_id=member,
             type="group_transaction",
             title=f"New expense in {group.name}",
             body=f"{actor.name} added ₹{amount} — {description}"
           )
           → this function BOTH saves to `notifications` collection
             AND calls websocket.manager.broadcast([member], event)
             in the same call, per TRD.md §9.1
   ══════════════════════════════════════════════════════════════
                       │
                       ▼
   Response 201 returned to the user who submitted the form
   (their own UI updates via normal TanStack Query invalidation)
                       │
                       ▼
   ╔══════════════════════════════════════════════════════════╗
   ║  MEANWHILE, for every OTHER member with an open WebSocket: ║
   ║                                                              ║
   ║  Browser receives: { type: "GROUP_TRANSACTION", payload }   ║
   ║         │                                                    ║
   ║         ▼                                                    ║
   ║  Zustand websocket store appends event                      ║
   ║         │                                                    ║
   ║         ▼                                                    ║
   ║  TanStack Query cache invalidated for:                       ║
   ║    ['groups', groupId, 'transactions']                       ║
   ║    ['balances']                                               ║
   ║         │                                                    ║
   ║         ▼                                                    ║
   ║  Toast appears: "Krishna added ₹500 — Dinner"                ║
   ║  Group transaction list updates WITHOUT page refresh         ║
   ╚══════════════════════════════════════════════════════════╝
```

### 8.3 View Balances
```
/balances → GET /api/v1/balances
                       │
                       ▼
       Aggregates all `balances` docs
       where user_id == current user
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
  net_amount > 0                  net_amount < 0
  "You owe ₹X to [Name]"          "[Name] owes you ₹Y"
```

---

## 9. Flow: Budget Goal Creation & Alert

```
/budget → "Set Budget" → Category | Period | Amount
                       │
                       ▼
         POST /api/v1/budgets/
                       │
                       ▼
       budgets/service.py saves to
       `budgets` collection
       alert_sent_80=false, alert_sent_100=false
                       │
                       ▼
       /budget page shows progress bar:
       GET /api/v1/budgets/status
       (current spend vs limit, computed
        live from `expenses` collection)

═══════════ Independent of user action — runs every hour ═══════════

APScheduler job (budgets/scheduler.py, in-process)
                       │
                       ▼
       For each active budget:
       compute current period spend
       from `expenses` collection
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
  spend >= 100% of budget         spend >= 80% of budget
  AND alert_sent_100=false        AND alert_sent_80=false
        │                               │
        ▼                               ▼
  Send email (SMTP) +              Send email (SMTP) +
  in-app notification              in-app notification
  (via notifications.service       (same path)
  .create_notification, which
  also pushes via WebSocket if
  user is currently connected)
        │                               │
        ▼                               ▼
  Set alert_sent_100=true          Set alert_sent_80=true
```

---

## 10. Flow: Analytics & Report Download

```
/analytics → period selector (Daily|Weekly|Monthly|Quarterly)
                       │
                       ▼
   GET /api/v1/analytics/expenses?period=monthly
   GET /api/v1/analytics/income?period=monthly
   GET /api/v1/analytics/net-balance
   GET /api/v1/analytics/recent-activity?limit=10
   (parallel TanStack Query calls)
                       │
                       ▼
       Recharts renders:
       - Pie/Bar chart: expense by category
       - Line/Bar chart: income vs expense over period
       - Net balance card
       - Recent activity feed

── Report Download ──
"Download Report" → modal: Start Date | End Date | Format (PDF/Excel)
                       │
                       ▼
   POST /api/v1/reports/download
   { start_date, end_date, format }
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
   format = "pdf"                  format = "excel"
   analytics/pdf_report.py         analytics/excel_report.py
   (ReportLab) builds table        (openpyxl) builds 3 sheets:
   of all expenses+income+         Expenses | Income |
   group transactions in range,   Group Transactions
   with totals row
        │                               │
        └──────────────┬───────────────┘
                       ▼
       Response: binary file with
       Content-Disposition: attachment
                       │
                       ▼
       Browser triggers download
       (no email step needed)
```

---

## 11. Flow: Notifications Bell

```
Header (always visible when logged in) → Bell icon with unread badge
                       │
                       ▼
   GET /api/v1/notifications?is_read=false (badge count, polled or
   updated via WebSocket NOTIFICATION events)
                       │
                       ▼
   Click bell → dropdown:
   GET /api/v1/notifications (paginated, most recent first)
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
   Click individual notif          Click "Mark all read"
   PUT /notifications/{id}/read    PUT /notifications/read-all
        │                               │
        └──────────────┬───────────────┘
                       ▼
       Badge count decreases,
       TanStack Query invalidates
       ['notifications']
```

---

## 12. Cross-Cutting: WebSocket Connection Lifecycle

```
On login success / on app load with valid token:
   lib/websocket.ts → new WebSocket(`${WS_URL}/ws/${userId}?token=${accessToken}`)
                       │
                       ▼
   Backend modules/websocket/router.py:
     - Decodes & validates JWT from query param
     - connection_manager.connect(user_id, websocket)
                       │
                       ▼
   Connection stays open for session duration
   Heartbeat/ping every 30s (frontend) to keep
   connection alive through Nginx/EC2 timeouts
                       │
        ┌──────────────┴───────────────┐
        ▼                               ▼
   Access token expires (15 min)   User closes tab / logs out
        │                               │
        ▼                               ▼
   Frontend refreshes token via    connection_manager.disconnect
   /auth/refresh, reconnects WS    (user_id) removes entry
   with new token (reconnect
   logic in lib/websocket.ts)
```

---

## 13. Error Handling Convention (applies to all flows above)

```
Any module raises a custom exception (e.g. ValidationError, NotFoundError,
UnauthorizedError) → caught by a global FastAPI exception handler in main.py
→ converted to:
   { "error": "ERROR_CODE", "message": "...", "details": {...} }
→ Frontend's API client (lib/api/client.ts) catches non-2xx responses,
   surfaces `message` via toast, and lets React Hook Form display
   `details` as field-level errors where applicable.
```

---

*End of App-Flow.md*
