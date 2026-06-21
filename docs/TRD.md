# FinTrack — Technical Requirements Document (TRD)

**Version:** 2.0 (Modular Monolith Architecture)
**Companion to:** `PRD.md`
**Read this before:** Any Claude Code sprint session — this is the architecture source of truth.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│            Next.js 14 (App Router) — Vercel               │
│  Pages: Auth | Dashboard | Expenses | Income | Groups     │
│         Analytics | Budget | Notifications                 │
└───────────────────────┬───────────────────────────────────┘
                         │ HTTPS / WSS
                         ▼
┌─────────────────────────────────────────────────────────┐
│              FINTRACK BACKEND (single app)                │
│                FastAPI — AWS EC2 (Docker)                  │
│                                                             │
│   /api/v1/auth/*          → auth module                   │
│   /api/v1/users/*         → user module (friends)         │
│   /api/v1/expenses/*      → expense module (+ OCR)        │
│   /api/v1/income/*        → income module                 │
│   /api/v1/groups/*        → group module (splits)         │
│   /api/v1/balances/*      → group module                  │
│   /api/v1/budgets/*       → budget module (+ APScheduler) │
│   /api/v1/analytics/*     → analytics module               │
│   /api/v1/reports/*       → analytics module (PDF/Excel)  │
│   /api/v1/notifications/* → notification module           │
│   /ws/{user_id}           → websocket module (in-process)  │
│                                                             │
│   Modules call each other via direct Python function       │
│   calls / shared service classes — NOT internal HTTP.      │
└───────────────────────┬───────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   MongoDB Atlas      │
              │   Database: fintrack │
              │   (Free Tier M0)     │
              └─────────────────────┘

ONE EC2 t2.micro instance runs ONE Docker container (the backend).
Nginx reverse-proxies port 80/443 → backend's internal port 8000,
and handles WebSocket upgrade headers for /ws/.
```

**Why this differs from a "true" microservices design:** the original architecture doc proposed 9 independently deployable services. For a solo developer shipping incrementally across Claude Code sessions, that adds Dockerfile/requirements.txt/middleware duplication 9x over with no functional benefit at 15-20 users of scale. This TRD keeps the **same domain boundaries** (so the code is still cleanly separated and could be split into real microservices later if needed) but ships them as **routers inside one FastAPI app**, sharing one process, one event loop, one Mongo connection pool, and one Docker container.

---

## 2. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend Framework | Next.js | 14 (App Router) | SSR, file-based routing, Vercel-native |
| Frontend Language | TypeScript | 5.x | |
| UI Library | shadcn/ui + Tailwind CSS | Latest | |
| State Management | Zustand | 4.x | Auth token, WebSocket event store |
| Server State / Cache | TanStack Query | 5.x | |
| WebSocket Client | Native browser WebSocket API | — | |
| Charts | Recharts | 2.x | |
| Form Handling | React Hook Form + Zod | Latest | |
| Backend Framework | FastAPI | 0.111+ | Single app, `APIRouter` per module |
| Backend Language | Python | 3.11+ | |
| Data Validation | Pydantic | v2 | |
| Database | MongoDB Atlas | M0 Free | **Single database**: `fintrack` |
| ODM | Motor (async) + Beanie | Latest | |
| Auth Tokens | PyJWT | 2.x | |
| Email | Gmail SMTP (App Password) | — | |
| OCR | Google Cloud Vision API | v1 | 1,000 free units/month |
| Task Scheduler | APScheduler | 3.x | Runs in-process inside the FastAPI app |
| PDF Generation | ReportLab | 4.x | |
| Excel Generation | openpyxl | 3.x | |
| Containerisation | Docker (single Dockerfile) | Latest | One container, not nine |
| Reverse Proxy | Nginx | Latest | Routes all `/api/v1/*` and `/ws/*` to one upstream |
| Deployment (FE) | Vercel | — | |
| Deployment (BE) | AWS EC2 t2.micro | Free Tier | |
| E2E Testing | Playwright | Latest | |

---

## 3. Backend Module Structure

Each "module" below replaces what was a separate microservice in the original doc. Each is a self-contained folder with its own router, models, and service logic, registered onto one FastAPI app.

```
backend/
├── main.py                     # FastAPI app instantiation, router registration, startup/shutdown events
├── core/
│   ├── config.py                # Settings (env vars) via pydantic-settings
│   ├── database.py              # Single Motor client / Beanie init for `fintrack` db
│   ├── security.py              # JWT encode/decode, password hashing
│   └── deps.py                  # Shared FastAPI dependencies (get_current_user, etc.)
├── modules/
│   ├── auth/
│   │   ├── router.py             # /api/v1/auth/*
│   │   ├── models.py             # User, OTP, RefreshToken (Beanie documents)
│   │   ├── schemas.py            # Pydantic request/response models
│   │   └── service.py            # Business logic (signup, login, otp, etc.)
│   ├── users/                    # profile + friends
│   │   ├── router.py             # /api/v1/users/*
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── expenses/
│   │   ├── router.py             # /api/v1/expenses/*
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── ocr.py                # Google Cloud Vision integration
│   ├── income/
│   │   ├── router.py             # /api/v1/income/*
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── groups/
│   │   ├── router.py             # /api/v1/groups/*, /api/v1/balances/*
│   │   ├── models.py             # Group, GroupTransaction, Balance
│   │   ├── schemas.py
│   │   └── service.py            # split calculation logic
│   ├── budgets/
│   │   ├── router.py             # /api/v1/budgets/*
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── scheduler.py          # APScheduler job registered at startup
│   ├── analytics/
│   │   ├── router.py             # /api/v1/analytics/*, /api/v1/reports/*
│   │   ├── schemas.py
│   │   ├── service.py            # aggregation pipelines
│   │   ├── pdf_report.py         # ReportLab
│   │   └── excel_report.py       # openpyxl
│   ├── notifications/
│   │   ├── router.py             # /api/v1/notifications/*
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py            # called internally by other modules, not via HTTP
│   └── websocket/
│       ├── router.py             # /ws/{user_id}
│       └── manager.py            # ConnectionManager (in-memory dict), broadcast()
├── shared/
│   └── enums.py                  # Category, PaymentType, SplitType, etc.
├── Dockerfile
├── requirements.txt
└── .env.example
```

### 3.1 Inter-module communication rule

Whenever the original doc said "Service A POSTs to Service B," that becomes a **direct async function call** in this architecture:

| Original (HTTP) | Now (in-process) |
|---|---|
| Expense Service POSTs to Notification Service | `expenses/service.py` calls `notifications.service.create_notification(...)` directly |
| Group Service POSTs to WebSocket Service `/internal/broadcast` | `groups/service.py` calls `websocket.manager.broadcast(user_ids, event)` directly |
| Budget Service POSTs to Notification Service | `budgets/scheduler.py` calls `notifications.service.create_notification(...)` directly |
| Analytics Service calls Expense + Income Service via REST | `analytics/service.py` queries the `expenses` and `income` collections directly (same DB) |

This eliminates all internal network hops, internal auth, and retry/timeout handling that a real microservices split would need — appropriate for this project's scale.

---

## 4. JWT Auth Flow

```
1. User logs in → auth module issues:
   - Access Token  (JWT, 15-min TTL, kept in memory via Zustand on frontend)
   - Refresh Token (JWT, 7-day TTL, httpOnly cookie)

2. Every API request includes:
   Authorization: Bearer <access_token>

3. FastAPI dependency get_current_user() (core/deps.py) validates the JWT
   using JWT_SECRET — shared across all modules since it's one process.

4. When access token expires:
   Frontend hits /api/v1/auth/refresh with httpOnly cookie
   → auth module returns new access token.
```

---

## 5. Database Schema (Single MongoDB Database: `fintrack`)

All collections live in one database. Field-level schema is unchanged from the original doc; only the database grouping is unified.

### 5.1 `users` collection
```json
{
  "_id": "ObjectId",
  "email": "string (unique, indexed)",
  "name": "string",
  "password_hash": "string",
  "is_verified": "boolean",
  "avatar_url": "string | null",
  "created_at": "datetime (IST)",
  "updated_at": "datetime (IST)"
}
```

### 5.2 `otps` collection (TTL index on `expires_at`)
```json
{
  "_id": "ObjectId",
  "email": "string (indexed)",
  "otp_hash": "string",
  "purpose": "signup | login | forgot_password",
  "expires_at": "datetime (TTL: 10 min)",
  "created_at": "datetime"
}
```

### 5.3 `refresh_tokens` collection (TTL index on `expires_at`)
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "token_hash": "string",
  "expires_at": "datetime (TTL: 7 days)"
}
```

### 5.4 `friendships` collection
```json
{
  "_id": "ObjectId",
  "requester_id": "string (indexed)",
  "addressee_id": "string (indexed)",
  "status": "pending | accepted",
  "created_at": "datetime"
}
```
Index: `{ requester_id: 1, addressee_id: 1 }` (unique compound)

### 5.5 `expenses` collection
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "category": "Food | Transport | Shopping | Entertainment | Health | Utilities | Other",
  "description": "string",
  "amount": "decimal (INR)",
  "date": "datetime (IST, indexed)",
  "payment_type": "Cash | UPI | Card | Net Banking",
  "source": "manual | ocr",
  "ocr_confidence": "float | null",
  "receipt_image_url": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```
Indexes: `{ user_id: 1, date: -1 }`, `{ user_id: 1, category: 1 }`

### 5.6 `income` collection
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "source_type": "salary | from_friend",
  "friend_id": "string | null",
  "description": "string",
  "amount": "decimal (INR)",
  "date": "datetime (IST, indexed)",
  "payment_type": "Cash | UPI | Card | Net Banking",
  "created_at": "datetime"
}
```
Index: `{ user_id: 1, date: -1 }`

### 5.7 `groups` collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "description": "string | null",
  "created_by": "string (user_id)",
  "members": ["user_id", "..."],
  "created_at": "datetime"
}
```
Index: `{ members: 1 }`

### 5.8 `group_transactions` collection
```json
{
  "_id": "ObjectId",
  "group_id": "string (indexed)",
  "description": "string",
  "total_amount": "decimal (INR)",
  "paid_by": "string (user_id)",
  "split_type": "equal | custom",
  "splits": [
    { "user_id": "string", "amount_owed": "decimal", "is_settled": "boolean (default: false)" }
  ],
  "date": "datetime (IST)",
  "created_by": "string (user_id)",
  "created_at": "datetime"
}
```
Index: `{ group_id: 1, date: -1 }`, `{ "splits.user_id": 1 }`

### 5.9 `balances` collection (denormalized for fast reads)
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "counterpart_id": "string (indexed)",
  "net_amount": "decimal (positive = user_id owes, negative = counterpart owes)",
  "updated_at": "datetime"
}
```
Index: `{ user_id: 1, counterpart_id: 1 }` (unique compound)

### 5.10 `budgets` collection
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "category": "string",
  "period": "daily | monthly | quarterly | yearly",
  "amount": "decimal (INR)",
  "alert_sent_80": "boolean (reset each period)",
  "alert_sent_100": "boolean (reset each period)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```
Index: `{ user_id: 1, category: 1, period: 1 }` (unique compound)

### 5.11 `notifications` collection
```json
{
  "_id": "ObjectId",
  "user_id": "string (indexed)",
  "type": "group_transaction | budget_alert | income_received | expense_added",
  "title": "string",
  "body": "string",
  "is_read": "boolean (default: false)",
  "metadata": { "group_id": "string | null", "transaction_id": "string | null" },
  "created_at": "datetime (indexed)"
}
```
Index: `{ user_id: 1, is_read: 1, created_at: -1 }`

> **Collection naming collision note:** `users` collection (auth) holds login credentials; there is no separate `profiles` collection — profile fields (`name`, `avatar_url`) live directly on the `users` document since auth and profile are now the same module's concern in practice (still exposed via both `/api/v1/auth/*` and `/api/v1/users/me` for clarity). This is a deliberate simplification from the original two-collection design.

---

## 6. API Design

### 6.1 Conventions
- Base URL: `https://<ec2-domain-or-ip>/api/v1/`
- All endpoints require `Authorization: Bearer <token>` unless marked `[PUBLIC]`
- All request/response bodies: `application/json`
- All dates: ISO 8601 UTC string (frontend converts to IST for display)
- Error format:
```json
{ "error": "VALIDATION_ERROR", "message": "Human readable message", "details": {} }
```

### 6.2 Auth Module — `/api/v1/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/signup` | PUBLIC | Register user, trigger OTP |
| POST | `/verify-otp` | PUBLIC | Verify signup OTP |
| POST | `/login` | PUBLIC | Login with email + password |
| POST | `/forgot-password` | PUBLIC | Request password reset OTP |
| POST | `/reset-password` | PUBLIC | Submit new password with OTP |
| POST | `/refresh` | COOKIE | Refresh access token |
| POST | `/logout` | JWT | Revoke refresh token |

### 6.3 Users Module — `/api/v1/users`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/me` | Get own profile |
| PUT | `/me` | Update profile |
| GET | `/search?email=` | Search user by email |
| POST | `/friends` | Add friend by user_id |
| GET | `/friends` | List all friends |
| DELETE | `/friends/{friend_id}` | Remove friend |

### 6.4 Expenses Module — `/api/v1/expenses`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create expense (manual) |
| POST | `/ocr` | Upload receipt image, returns pre-filled data |
| POST | `/ocr/confirm` | Confirm OCR-parsed expense |
| GET | `/` | List expenses (filter: category, date_from, date_to) |
| GET | `/{id}` | Get single expense |
| PUT | `/{id}` | Update expense |
| DELETE | `/{id}` | Delete expense |

### 6.5 Income Module — `/api/v1/income`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Add income entry |
| GET | `/` | List income (filter: source_type, date_from, date_to) |
| GET | `/{id}` | Get single income record |
| PUT | `/{id}` | Update income |
| DELETE | `/{id}` | Delete income |

### 6.6 Groups Module — `/api/v1/groups`, `/api/v1/balances`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/groups` | Create group |
| GET | `/groups` | List user's groups |
| GET | `/groups/{id}` | Get group details + member list |
| PUT | `/groups/{id}` | Update group |
| POST | `/groups/{id}/members` | Add member to group |
| DELETE | `/groups/{id}/members/{user_id}` | Remove member |
| POST | `/groups/{id}/transactions` | Add group transaction + split |
| GET | `/groups/{id}/transactions` | List group transactions |
| GET | `/balances` | Get all balances (owes/owed) for user |
| GET | `/balances/{friend_id}` | Balance with a specific friend |

### 6.7 Budgets Module — `/api/v1/budgets`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create budget goal |
| GET | `/` | List all budgets for user |
| PUT | `/{id}` | Update budget |
| DELETE | `/{id}` | Delete budget |
| GET | `/status` | Current spend vs. budget for all active budgets |

### 6.8 Analytics Module — `/api/v1/analytics`, `/api/v1/reports`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/expenses?period=daily\|weekly\|monthly\|quarterly` | Expense breakdown by category |
| GET | `/analytics/income?period=...` | Income breakdown |
| GET | `/analytics/net-balance` | Net balance (income − expense) |
| GET | `/analytics/recent-activity?limit=10` | Recent transactions feed |
| POST | `/reports/download` | Generate + return PDF or Excel file |

Request body for report:
```json
{ "start_date": "2026-01-01", "end_date": "2026-06-30", "format": "pdf | excel" }
```

### 6.9 Notifications Module — `/api/v1/notifications`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List notifications for user (paginated) |
| PUT | `/{id}/read` | Mark notification as read |
| PUT | `/read-all` | Mark all as read |

> Note: there is no `/internal/send` endpoint anymore — other modules call `notifications.service.create_notification()` directly in-process.

### 6.10 WebSocket — `/ws/{user_id}`
```
WS endpoint: wss://<ec2-domain>/ws/{user_id}?token=<jwt>

On connect:    Server validates JWT, registers user_id → connection in ConnectionManager
On message:    Server pushes JSON events:
               { "type": "GROUP_TRANSACTION", "payload": {...} }
               { "type": "BUDGET_ALERT",      "payload": {...} }
               { "type": "NOTIFICATION",      "payload": {...} }
On disconnect: Server removes connection from ConnectionManager
```

Other modules broadcast by calling the manager directly:
```python
from modules.websocket.manager import connection_manager
await connection_manager.broadcast(user_ids=["uid1","uid2"], event={...})
```
(No HTTP call — this replaces the original `/internal/broadcast` POST endpoint.)

---

## 7. Real-Time Architecture

### 7.1 WebSocket Flow for Group Transaction
```
1. User A adds a transaction in Group G (POST /api/v1/groups/{id}/transactions)

2. groups/service.py:
   a. Saves transaction + splits to MongoDB
   b. Updates balances collection
   c. For each affected member (B, C, D):
      - calls notifications.service.create_notification(...) directly
      - calls websocket.manager.broadcast([...], event) directly

3. websocket/manager.py:
   a. Looks up active connections for B, C, D
   b. Pushes event to each connected client instantly

4. Client (Next.js):
   a. WebSocket message listener receives event
   b. Zustand store is updated with new transaction
   c. TanStack Query cache for /balances is invalidated → refetch
   d. Toast notification appears on screen
```

### 7.2 Connection Manager (in-process, single app)
```python
# modules/websocket/manager.py
from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active[user_id] = ws

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    async def broadcast(self, user_ids: List[str], event: dict):
        for uid in user_ids:
            ws = self.active.get(uid)
            if ws:
                await ws.send_json(event)

connection_manager = ConnectionManager()
```

> **Scale note:** an in-memory dict works because this is a single process/single container. If this were ever split into multiple backend replicas, you'd need Redis pub/sub instead — out of scope at 15-20 users.

---

## 8. OCR Integration

### 8.1 Flow
```
1. User selects "Upload Receipt" on Expense page
2. Frontend: file input → reads as base64
3. POST /api/v1/expenses/ocr { image_base64: "...", mime_type: "image/jpeg" }

4. expenses/ocr.py:
   a. Calls Google Cloud Vision API (TEXT_DETECTION)
   b. Parses response to extract:
      - Amount: regex for currency patterns (₹xxx, Rs. xxx)
      - Date: dateutil parser on detected text
      - Merchant: first line of detected text block
   c. Returns structured data + raw_text + confidence_score

5. Frontend: pre-fills form with extracted data
6. User reviews, edits if needed, clicks Confirm
7. POST /api/v1/expenses/ocr/confirm → saves expense
```

### 8.2 Google Cloud Vision Setup
```python
# requirements.txt
google-cloud-vision==3.7.2

from google.cloud import vision
client = vision.ImageAnnotatorClient()
image = vision.Image(content=base64.b64decode(image_base64))
response = client.text_detection(image=image)
texts = response.text_annotations
full_text = texts[0].description if texts else ""
```
**Free tier:** 1,000 units/month. At 20 receipts/day × 30 days = 600/month — within free tier.

### 8.3 Amount Extraction Logic
```python
import re
from decimal import Decimal

def extract_amount(text: str) -> Decimal | None:
    patterns = [
        r'(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)',
        r'Total[:\s]*([\d,]+\.?\d*)',
        r'Amount[:\s]*([\d,]+\.?\d*)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return Decimal(match.group(1).replace(',', ''))
    return None
```

---

## 9. Notification & Budget Cron Architecture

### 9.1 In-App Notifications
- Any module calls `notifications.service.create_notification(...)` directly when a notable event occurs.
- That function saves the record to MongoDB AND calls `websocket.manager.broadcast(...)` in the same call — no separate dispatch step needed.

### 9.2 Email Notifications
- Library: `fastapi-mail` or `smtplib` with Gmail SMTP (App Password).
- Triggered for: budget alerts (80%/100%), OTP delivery.
- Plain HTML email template with FinTrack branding.

### 9.3 Budget Cron Job (APScheduler, in-process)
```python
# modules/budgets/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

@scheduler.scheduled_job("interval", hours=1)
async def evaluate_budgets():
    budgets = await get_all_active_budgets()
    for budget in budgets:
        spent = await get_spending_for_period(budget.user_id, budget.category, budget.period)
        ratio = spent / budget.amount
        if ratio >= 1.0 and not budget.alert_sent_100:
            await send_budget_alert(budget, "EXCEEDED", spent)
            await mark_alert_sent(budget.id, "100")
        elif ratio >= 0.8 and not budget.alert_sent_80:
            await send_budget_alert(budget, "NEAR_LIMIT", spent)
            await mark_alert_sent(budget.id, "80")
```
Registered at app startup in `main.py`:
```python
@app.on_event("startup")
async def startup_event():
    from modules.budgets.scheduler import scheduler
    scheduler.start()
```

---

## 10. Deployment Architecture

### 10.1 AWS EC2 Setup (t2.micro, Free Tier)
```
EC2 Instance (Ubuntu 22.04)
├── Docker
├── Docker Compose (single service: backend)
├── Nginx (reverse proxy on port 80/443, also handles WSS upgrade)
└── backend container (port 8000 internal)
```

### 10.2 Nginx Routing Config
```nginx
server {
    listen 80;
    server_name <your-ec2-public-ip-or-domain>;

    location /api/v1/ {
        proxy_pass http://localhost:8000;
    }

    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 10.3 docker-compose.yml
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    restart: always
```

### 10.4 Environment Variables (.env)
```
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=fintrack
JWT_SECRET=<strong-secret>
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx
GOOGLE_VISION_API_KEY=xxxx
NEXT_PUBLIC_API_BASE_URL=https://<ec2-domain-or-ip>
NEXT_PUBLIC_WS_URL=wss://<ec2-domain-or-ip>
```

### 10.5 Vercel Deployment (Frontend)
```
1. Push Next.js project to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard:
   NEXT_PUBLIC_API_BASE_URL=https://<ec2-domain-or-ip>
   NEXT_PUBLIC_WS_URL=wss://<ec2-domain-or-ip>
4. Every push to `main` auto-deploys to Vercel
```

### 10.6 Monorepo Structure
```
fintrack/
├── frontend/                   # Next.js app (deployed to Vercel)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   ├── dashboard/
│   │   ├── expenses/
│   │   ├── income/
│   │   ├── groups/
│   │   ├── analytics/
│   │   └── budget/
│   ├── components/
│   ├── lib/
│   │   ├── api/                # API client functions
│   │   ├── store/               # Zustand stores
│   │   └── websocket.ts         # WebSocket hook
│   └── package.json
│
├── backend/                    # Single FastAPI app (deployed to EC2)
│   ├── main.py
│   ├── core/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── expenses/
│   │   ├── income/
│   │   ├── groups/
│   │   ├── budgets/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   └── websocket/
│   ├── shared/
│   ├── Dockerfile
│   └── requirements.txt
│
├── tests/                      # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── expenses.spec.ts
│   ├── groups.spec.ts
│   └── ...
│
├── docker-compose.yml
├── nginx.conf
├── docs/                       # This documentation set
│   ├── PRD.md
│   ├── TRD.md
│   ├── App-Flow.md
│   ├── Implementation-Plan.md
│   ├── Manual-Setup.md
│   └── sprints/
│       ├── Sprint-01.md
│       ├── ...
│       └── Sprint-10.md
└── README.md
```

---

## 11. Testing Strategy

### 11.1 Playwright Setup
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  baseURL: 'http://localhost:3000',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

### 11.2 Test Conventions
- Each spec file maps to one sprint's frontend goals.
- Tests use `test.beforeAll` to seed data (create test user via API).
- Tests use `test.afterAll` to clean up (delete test user and their data).
- Shared fixtures: `loginAsTestUser()`, `createTestGroup()`, etc. in `tests/fixtures/`.

### 11.3 Test Coverage Matrix (mapped to revised sprint numbers — see Implementation-Plan.md)
| Sprint | Spec File | Key Scenarios |
|---|---|---|
| 3 | `auth.spec.ts` | Signup, OTP, Login, Forgot Password |
| 5 | `expenses.spec.ts` | Manual add, OCR upload, Edit, Delete |
| 5 | `income.spec.ts` | Salary, From Friend |
| 6 | `friends.spec.ts` | Search, Add, Remove |
| 6 | `websocket.spec.ts` | Real-time event delivery (smoke) |
| 7 | `groups.spec.ts` | Create, Transactions, Splits, Real-time |
| 8 | `budget.spec.ts` | CRUD, Progress |
| 8 | `notifications.spec.ts` | In-app bell, Mark read |
| 9 | `analytics.spec.ts` | Charts, Period filter, Downloads |
| 10 | `full-flow.spec.ts` | Complete user journey |

---

*End of TRD.md*
