# FinTrack — Product Requirements Document (PRD)

**Version:** 2.0 (Revised for solo-dev modular-monolith build)
**Date:** June 2026
**Type:** College / Portfolio Project — Solo Developer
**Status:** Pre-Development
**Supersedes:** Original `FinTrack_PRD_Architecture.md` v1.0 (kept for historical reference only — architecture section in that file is OUTDATED, see TRD.md instead)

---

## 1. Executive Summary

**FinTrack** is a full-stack personal finance tracking and bill-splitting web application for a small group of ~15–20 users. It enables individuals to track expenses and income, split bills with friends and groups (Splitwise-style), set budget goals, receive alerts, view analytics, and download reports. A receipt OCR feature lets users scan physical bills to auto-fill expense forms.

### 1.1 Key Decisions (Revised)

| Concern | Decision |
|---|---|
| Frontend | Next.js 14 (App Router) on Vercel — **1 deployable unit** |
| Backend | **Single FastAPI app** ("modular monolith") on AWS EC2 — **1 deployable unit** |
| Backend internals | Domain modules (auth, expense, income, group, budget, notification, analytics) as FastAPI routers, calling each other via internal Python function calls, not HTTP |
| Database | **Single MongoDB Atlas database** (`fintrack`), one collection per domain |
| Auth | Email OTP + JWT (access + refresh tokens) |
| Real-time | Native WebSockets, run in-process inside the same FastAPI app |
| OCR | Google Cloud Vision API (free tier: 1,000 units/month) |
| Notifications | Email (SMTP/Gmail App Password) + In-app (WebSocket push) |
| Currency | INR only |
| Timezone | Asia/Kolkata (IST, UTC+5:30) |
| AI in v1 | Receipt OCR only |
| Reports | PDF + Excel download |
| Splitting | Equal splits and custom amount splits |
| Testing | Playwright E2E after each sprint where frontend work exists |
| Scale | 15–20 users (college project, not production scale) |
| Deployment | AWS EC2 t2.micro (backend, Docker) + Vercel (frontend) |

> **Why the architecture changed from the original doc:** The original v1.0 doc specified 9 independent FastAPI microservices on 9 ports, each with its own MongoDB database. For a solo developer building this across ~10 individual Claude Code sessions, that level of duplication (JWT middleware, Dockerfile, requirements.txt, error handling copy-pasted 9 times) adds significant token/time overhead without adding learning value — the same module boundaries, the same skills (FastAPI, async Mongo, WebSockets, JWT, OCR, cron jobs) are demonstrated by a single well-structured app. All **functional requirements, user stories, and acceptance criteria below are unchanged** from the original document. Only the deployment topology changed: 9 services → 1 backend app with internal modules.

---

## 2. Product Vision & Scope

### 2.1 Problem Statement

Students and young professionals lack a unified tool that combines personal expense tracking, income tracking, and friend-based bill splitting in a single, simple interface. Most apps either do one or the other, or are too complex for casual use.

### 2.2 Product Goals

- Provide a frictionless experience for logging expenses — manual or via receipt scan.
- Enable transparent bill splitting among friends and groups.
- Alert users proactively when they approach or breach budget thresholds.
- Deliver actionable analytics and downloadable financial reports.

### 2.3 V1 Scope — In

- Email OTP-based Auth (Signup, Login, Forgot Password)
- Manual expense entry with category, description, amount, date, payment type
- Receipt image OCR (Google Cloud Vision) to auto-fill expense forms
- Income tracking (salary or received from friend)
- Contact/Friend management
- Group creation and management
- Bill splitting (equal and custom) among friends/groups
- Real-time transaction sync when any participant adds a transaction
- Budget goals (daily, monthly, quarterly, yearly) with email + in-app alerts
- Analytics dashboard (by category and time period)
- Downloadable reports (PDF + Excel) with custom date range
- Playwright E2E test coverage per sprint (frontend sprints)

### 2.4 V1 Scope — Out

- Native mobile apps
- Social login (Google/Apple)
- Payment gateway integration (UPI, Stripe)
- Automatic debt simplification
- Multi-currency support
- Recurring transactions
- GDPR/compliance features
- AI features beyond OCR (LLM chat, predictive alerts)

---

## 3. User Stories & Acceptance Criteria

### 3.1 Authentication

**US-01 — Signup**
> As a new user, I want to register with my name, email, and an OTP sent to my email so that I have a secure account.

Acceptance Criteria:
- Form collects: Full Name, Email, Password, Confirm Password.
- On submit, a 6-digit OTP is sent to the provided email.
- OTP expires in 10 minutes.
- On correct OTP entry, account is created and user is redirected to the dashboard.
- Duplicate email shows a clear error message.

**US-02 — Login**
> As a registered user, I want to log in with email + password so that my account is secure.

Acceptance Criteria:
- Login accepts email and password.
- On success, a JWT access token (15-min TTL) and refresh token (7-day TTL) are issued.
- Access token is stored in memory (Zustand); refresh token in an httpOnly cookie.
- Failed login shows "Invalid credentials" after 3 attempts, locks for 5 minutes.

**US-03 — Forgot Password**
> As a user, I want to reset my password via an OTP sent to my email.

Acceptance Criteria:
- User enters registered email.
- A 6-digit OTP is emailed.
- On correct OTP, user can set a new password.
- Password confirmation must match.
- OTP expires in 10 minutes.

---

### 3.2 Expense Management

**US-04 — Add Expense (Manual)**
> As a user, I want to manually add an expense with category, description, amount, date, and payment type.

Acceptance Criteria:
- Fields: Category (dropdown), Event Description (text), Amount (INR, numeric), Date (defaults to today IST), Payment Type (Cash / UPI / Card / Net Banking).
- All fields except Description are mandatory.
- Saved expense appears immediately on the dashboard and in analytics.

**US-05 — Add Expense (OCR / Receipt Image)**
> As a user, I want to upload a photo of a bill and have the form auto-filled, which I can edit and confirm.

Acceptance Criteria:
- User uploads JPG/PNG (max 5MB).
- Google Cloud Vision API extracts: amount, date, merchant name (mapped to description).
- Auto-filled form is editable before submission.
- If OCR confidence is low, a warning banner appears.
- User must explicitly click "Confirm & Save."
- Fallback: if OCR returns no data, form opens blank with a toast notification.

---

### 3.3 Income Tracking

**US-06 — Add Income**
> As a user, I want to record income specifying source type, amount, date, description, and payment type.

Acceptance Criteria:
- Source Type: Salary or From Friend.
- If "From Friend" is selected, a searchable dropdown of the user's contacts appears.
- Fields: Description, Date (defaults to today IST), Amount (INR), Payment Type.
- Saved income appears on the dashboard and in analytics as positive cash flow.

---

### 3.4 Friends & Groups

**US-07 — Add Friend / Contact**
> As a user, I want to add other registered users as friends using their email address.

Acceptance Criteria:
- User searches by email.
- If found in the system, a friend request/link is created.
- Friend appears in contact list once added.
- Cannot add yourself.

**US-08 — Create Group**
> As a user, I want to create a group from my existing friends to manage shared expenses.

Acceptance Criteria:
- Group requires: Name, optional description, and member selection from existing friends.
- Creator is automatically a member.
- Group appears in the "Groups" section of the dashboard.

---

### 3.5 Group Transactions & Bill Splitting

**US-09 — Add Group Transaction**
> As a user, I want to add a shared expense for a group, specify who paid, and split it among members.

Acceptance Criteria:
- Fields: Amount (INR), Event Description, Paid By (dropdown of group members), Split Among (multi-select of members), Split Type (Equal / Custom).
- Equal split: Amount / number of selected members.
- Custom split: User assigns specific amounts per person; total must equal the transaction amount.
- On save, individual debt records are created for each member who owes the payer.
- All affected members receive a real-time in-app notification via WebSocket.
- The transaction appears in every involved member's dashboard history instantly.

**US-10 — View Balances**
> As a user, I want to see who owes me and whom I owe across all groups and direct friend transactions.

Acceptance Criteria:
- Summary view: "You owe ₹X to [Name]" and "Name owes you ₹Y."
- Filterable by group or individual friend.
- Shows transaction history per friend/group.

---

### 3.6 Budget Goals

**US-11 — Set Budget Goal**
> As a user, I want to set a spending budget for a specific category and time period.

Acceptance Criteria:
- Fields: Category (same as expense categories), Period (Daily / Monthly / Quarterly / Yearly), Budget Amount (INR).
- One budget per category+period combination; editing replaces old budget.
- Cron job runs every hour to evaluate current spending vs. budget.
- Alert sent (email + in-app) when spending reaches 80% of budget.
- Alert sent (email + in-app) when spending equals or exceeds 100% of budget.

---

### 3.7 Analytics

**US-12 — Analytics Dashboard**
> As a user, I want to view a visual breakdown of my spending and income across different time periods.

Acceptance Criteria:
- Expense breakdown by category: bar/pie chart.
- Time period filter: Daily, Weekly, Monthly, Quarterly.
- Recent Activity feed: last 10 transactions (expense/income/group) in reverse chronological order.
- Net balance (Total Income − Total Expense) displayed prominently.

**US-13 — Download Report**
> As a user, I want to download a financial report for a custom date range in PDF or Excel format.

Acceptance Criteria:
- User selects: Start Date, End Date, Format (PDF / Excel).
- Report includes: all expenses, all income, group transactions involving the user, net balance.
- PDF: formatted table with header, footer, and totals row.
- Excel: separate sheets for Expenses, Income, and Group Transactions.
- Download triggers immediately (no email delivery needed).

---

## 4. Non-Functional Requirements

- **Performance:** App usable for 15-20 concurrent users on a t2.micro instance; no specific load-testing requirement.
- **Security:** Passwords hashed (bcrypt), JWT signed with strong secret, OTPs hashed at rest, OTPs single-use.
- **Reliability:** No specific uptime SLA (college project); restart-on-failure via Docker `restart: always`.
- **Maintainability:** Single backend codebase organized by domain module so each Claude Code sprint can work within a clear folder boundary without touching unrelated modules.
- **Browser support:** Latest Chrome/Edge (Playwright `chromium` project only, per original testing strategy).

---

## 5. Out-of-Document Cross-References

This PRD defines **what** to build and **why**. For **how**, see:
- `TRD.md` — Technical architecture, schema, API contracts, module structure
- `App-Flow.md` — End-to-end user and data flow diagrams
- `Implementation-Plan.md` — Phase/sprint roadmap overview
- `Manual-Setup.md` — Steps Krishna must do manually outside Claude Code (account creation, API keys, etc.)
- `sprints/Sprint-XX.md` — Self-contained spec per Claude Code session

---

*End of PRD.md*
