# FinTrack — Implementation Plan

**Companion to:** `PRD.md`, `TRD.md`, `App-Flow.md`
**Purpose:** Roadmap overview tying together all 10 sprints. Each sprint = one fresh Claude Code session with no memory of prior sessions.

---

## 1. How This Plan Works

- **One sprint = one fresh Claude Code session.** Every session starts with zero memory of previous sessions (per Krishna's confirmed workflow, same as JobTrack).
- **Each sprint doc is self-contained.** `sprints/Sprint-XX.md` always begins with a "Context to Read First" section pointing back to `PRD.md`, `TRD.md`, `App-Flow.md`, and the **previous sprint's "Handoff Notes"** so the new session can orient itself quickly without re-deriving architecture decisions.
- **Every sprint ends with a "Handoff Notes" section** — what was built, what decisions were made, what the NEXT sprint needs to know. This is the continuity mechanism across sessions.
- **Every sprint has a Definition of Done** with explicit checkboxes Krishna can verify manually, plus automated Playwright tests where frontend work is involved.
- **Backend-only sprints** don't require Playwright; they're verified via `curl`/Postman-style manual checks (commands provided in the sprint doc) or a quick pytest smoke test.

---

## 2. Sprint Roadmap (10 Sprints)

| # | Sprint Title | Layer | Builds On |
|---|---|---|---|
| 1 | Project Scaffold & Infrastructure | Both (setup) | — |
| 2 | Auth Module — Backend | Backend | Sprint 1 |
| 3 | Auth Module — Frontend + Dashboard Shell | Frontend | Sprint 2 |
| 4 | Expense Module — Backend (incl. OCR) | Backend | Sprint 2 |
| 5 | Expense + Income — Frontend | Frontend | Sprint 3, 4 |
| 6 | Users/Friends Module + WebSocket Infra | Backend | Sprint 2 |
| 7 | Groups & Splitting — Backend + Frontend | Both | Sprint 4, 6 |
| 8 | Budgets + Notifications — Backend + Frontend | Both | Sprint 4, 6 |
| 9 | Analytics & Reports — Backend + Frontend | Both | Sprint 4, 7, 8 |
| 10 | E2E Polish, Deployment & Documentation | Both | All previous |

### 2.1 Why this grouping (consolidated from the original 15)

| Original (15) | Consolidated Into | Reason |
|---|---|---|
| Sprint 1: Infra setup (9 services) | Sprint 1 | Simplified — 1 backend skeleton instead of 9 |
| Sprint 2: Auth Service | Sprint 2 | Same scope, now just one module folder |
| Sprint 3: Auth Frontend | Sprint 3 | Combined with dashboard shell (small enough together) |
| Sprint 4: Expense Service | Sprint 4 | Same scope, includes OCR (was already together) |
| Sprint 5: Expense Frontend | Sprint 5 | Combined with Income (both small, similar CRUD forms) |
| Sprint 6: Income Service | Sprint 4 (merged) | Income backend is small; folded into Expense backend sprint since both are simple CRUD modules sharing patterns |
| Sprint 7: Income Frontend | Sprint 5 (merged) | See above |
| Sprint 8: User/Friend Service | Sprint 6 | Combined with WebSocket infra since friends are a prerequisite for groups, and WS is needed before group real-time |
| Sprint 9: Friend Frontend | Sprint 7 (merged into Groups FE) | Friend list UI is small; built alongside Groups frontend where friends are actually used (member selection) |
| Sprint 10: Group/Split Service | Sprint 7 | Same scope |
| Sprint 11: Group Frontend + Real-time | Sprint 7 (merged) | Backend+frontend combined since the real-time loop needs to be tested end-to-end together anyway |
| Sprint 12: Budget Service | Sprint 8 | Combined backend+frontend (small CRUD + progress bars) |
| Sprint 13: Notification Service | Sprint 8 (merged) | Notifications are mostly "called by other modules" — small standalone surface (bell dropdown), fits naturally with Budget sprint |
| Sprint 14: Analytics Service + Reports | Sprint 9 | Combined backend+frontend (charts need backend data shape decided together) |
| Sprint 15: Deployment + Testing | Sprint 10 | Same scope |

**Net result:** 15 → 10 sessions, with backend+frontend combined wherever the pair is small enough to fit one session's context budget, and split apart only where the surface area (Auth, Groups) is large enough to risk an incomplete/rushed session otherwise.

---

## 3. Sprint Sizing Philosophy

Each sprint is scoped to roughly:
- 1 major module (or 2 small related modules)
- 8-15 new/modified files
- A testable, demoable outcome at the end (even backend-only sprints should be curl-able)

Sprints 3, 5, 7, 9 are frontend-heavy and include Playwright specs. Sprints 2, 4, 6 are backend-heavy. Sprints 1, 8, 10 are mixed/infra.

---

## 4. Pre-Sprint-1 Prerequisites

Before Sprint 1 can begin, Krishna must complete manual setup steps in `Manual-Setup.md` — specifically:
- MongoDB Atlas cluster created, connection string obtained
- GitHub repo created (empty, ready to push monorepo)
- Gmail App Password generated (for OTP/alert emails)
- Google Cloud Vision API key obtained (for OCR — needed by Sprint 4, but good to get early)
- AWS account + EC2 key pair ready (instance itself can be launched right before Sprint 10, or earlier if Krishna wants to deploy incrementally)

See `Manual-Setup.md` for exact steps.

---

## 5. Sprint Dependency Graph

```
Sprint 1 (Scaffold)
    │
    ▼
Sprint 2 (Auth Backend)
    │
    ├──────────────┬───────────────┐
    ▼              ▼               ▼
Sprint 3        Sprint 4        Sprint 6
(Auth FE +      (Expense BE     (Friends BE +
Dashboard)      + OCR)          WebSocket)
    │              │               │
    │              ▼               │
    │         Sprint 5             │
    │         (Expense +           │
    │          Income FE)          │
    │              │               │
    └──────┬───────┴───────┬───────┘
           ▼                ▼
      Sprint 7          Sprint 8
      (Groups BE+FE,    (Budgets +
       needs Friends    Notifications,
       + WebSocket +    needs WebSocket
       Expense data     from Sprint 6)
       shape)               │
           │                │
           └───────┬────────┘
                   ▼
              Sprint 9
              (Analytics + Reports,
               needs Expense, Income,
               Group transaction data)
                   │
                   ▼
              Sprint 10
              (E2E, Deploy, Docs)
```

**Important for session ordering:** Sprints 3, 4, and 6 can technically be done in any order relative to each other (all only depend on Sprint 2), but the recommended linear order (3 → 4 → 5 → 6 → 7...) is given in each sprint doc's "Context to Read First" section so Krishna doesn't have to think about it — just follow the numbers.

---

## 6. What Each Sprint Delivers (Summary)

### Sprint 1 — Project Scaffold & Infrastructure
Monorepo structure, FastAPI skeleton with health-check route, Next.js 14 skeleton, MongoDB connection (Motor/Beanie init), Docker + docker-compose for backend, base Tailwind/shadcn setup, Playwright config, `.env.example` files, git initialized and pushed.

### Sprint 2 — Auth Module (Backend)
`modules/auth/` complete: signup, OTP generation+email, OTP verification, login, JWT issuance, refresh, forgot/reset password, `core/security.py`, `core/deps.py` (get_current_user dependency used by all future modules).

### Sprint 3 — Auth Frontend + Dashboard Shell
Login/Signup/OTP/Forgot-password pages, Zustand auth store, API client with token attach + refresh-on-401 interceptor, protected route wrapper, dashboard shell layout (sidebar/header/nav), empty dashboard page with placeholder cards. Playwright: `auth.spec.ts`.

### Sprint 4 — Expense Module (Backend, incl. OCR) + Income Module (Backend)
`modules/expenses/` complete incl. OCR via Google Cloud Vision, `modules/income/` complete. Both are simple CRUD-style modules grouped into one backend sprint.

### Sprint 5 — Expense + Income Frontend
Expense list/add/edit/delete pages, OCR upload UI with review step, Income list/add/edit/delete pages. Playwright: `expenses.spec.ts`, `income.spec.ts`.

### Sprint 6 — Users/Friends Module + WebSocket Infrastructure (Backend)
`modules/users/` (profile + friends), `modules/websocket/` (ConnectionManager, `/ws/{user_id}` route, JWT validation on connect), `modules/notifications/` skeleton (model + service function signature, used in later sprints), frontend WebSocket hook (`lib/websocket.ts`) wired into dashboard layout so connection opens on login.

### Sprint 7 — Groups & Splitting (Backend + Frontend, the core real-time flow)
`modules/groups/` complete (create group, manage members, add transaction with equal/custom split, balance calculation), notification+WebSocket broadcast wired in per App-Flow.md §8.2, Groups frontend pages (list, detail, add transaction form, balances view), real-time toast/update on receiving WS events. Playwright: `groups.spec.ts` (including a real-time assertion using two browser contexts).

### Sprint 8 — Budgets + Notifications (Backend + Frontend)
`modules/budgets/` complete incl. APScheduler hourly job, `modules/notifications/` complete (list/mark-read endpoints), Budget frontend (CRUD + progress bars), Notification bell dropdown frontend. Playwright: `budget.spec.ts`, `notifications.spec.ts`.

### Sprint 9 — Analytics & Reports (Backend + Frontend)
`modules/analytics/` complete (aggregation queries for category/period breakdowns, recent activity, PDF via ReportLab, Excel via openpyxl), Analytics frontend (Recharts visualizations, period filter, report download modal). Playwright: `analytics.spec.ts`.

### Sprint 10 — E2E Polish, Deployment & Documentation
Full-flow Playwright test, AWS EC2 provisioning + Docker deploy + Nginx config, Vercel frontend deploy + env vars, smoke test in production, README.md, final bug fixes found during E2E pass.

---

## 7. Token/Context Budget Guidance Per Sprint

To keep each Claude Code session realistic in size:
- **Backend sprints** (2, 4, 6): touch 1-2 module folders, ~8-12 files, manageable in one session including tests.
- **Frontend sprints** (3, 5, 9): touch 1-2 page groups + shared lib code, ~10-15 files.
- **Combined sprints** (7, 8): larger — these are flagged in their sprint docs to work backend-first, verify with curl, THEN build frontend in the same session, to avoid losing context switching back and forth.
- **Sprint 10**: mostly configuration/deployment, not large code generation — should fit comfortably even with E2E test writing included.

If any sprint genuinely runs out of context mid-way, the sprint doc's Handoff Notes template should still be filled out manually by Krishna noting "INCOMPLETE — stopped at X" so the next session (even a retry of the same sprint) knows where to resume.

---

*End of Implementation-Plan.md*
