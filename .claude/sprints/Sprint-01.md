# Sprint 1 — Project Scaffold & Infrastructure

**Layer:** Both (setup)
**Depends on:** Nothing (first sprint)
**Estimated files touched:** ~20-25 (mostly config/boilerplate)

---

## Context to Read First

This is the first sprint — no prior Handoff Notes exist. Before starting, read in this order:
1. `docs/PRD.md` — Section 1 (Executive Summary, Key Decisions table) and Section 2.3/2.4 (scope)
2. `docs/TRD.md` — Section 1 (Architecture Overview), Section 2 (Tech Stack), Section 3 (Backend Module Structure), Section 10 (Deployment Architecture, especially §10.6 Monorepo Structure)
3. `docs/Manual-Setup.md` — Section 1 and 2 — **confirm Krishna has completed these before starting** (MongoDB URI + GitHub repo). If not, STOP and ask Krishna to complete them first.

---

## Goal

Stand up the full monorepo skeleton: a working FastAPI backend with a health-check endpoint and live MongoDB connection, a working Next.js 14 frontend with Tailwind/shadcn configured, Docker for the backend, and Playwright configured — all pushed to the GitHub repo. **No business logic yet** — this sprint is pure scaffolding so every future sprint has a stable foundation.

---

## Tasks

### 1. Monorepo Root Setup
- Initialize git repo (or connect to the existing empty GitHub repo from Manual-Setup.md §2).
- Create root structure exactly as shown in `TRD.md` §10.6:
  ```
  fintrack/
  ├── frontend/
  ├── backend/
  ├── tests/
  ├── docker-compose.yml
  ├── nginx.conf
  ├── docs/          (this documentation set — copy PRD.md, TRD.md, App-Flow.md,
                       Implementation-Plan.md, Manual-Setup.md, sprints/ here)
  └── README.md       (placeholder for now, filled properly in Sprint 10)
  ```
- Root `.gitignore` covering: `node_modules/`, `.next/`, `__pycache__/`, `*.pyc`, `.env`, `.env.local`, `venv/`, `.pytest_cache/`, `playwright-report/`, `test-results/`.

### 2. Backend Skeleton (`backend/`)
- Python 3.11+ virtual environment setup instructions in a comment at top of `requirements.txt`.
- `requirements.txt` with initial deps: `fastapi`, `uvicorn[standard]`, `motor`, `beanie`, `pydantic-settings`, `python-jose[cryptography]` or `PyJWT`, `passlib[bcrypt]`, `python-multipart`, `pytest`, `httpx` (for testing).
- `core/config.py` — `Settings` class via `pydantic-settings`, reading from `.env`: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `JWT_ACCESS_TTL_MINUTES`, `JWT_REFRESH_TTL_DAYS`.
- `core/database.py` — Motor client initialization + Beanie `init_beanie()` call, with an empty `document_models=[]` list for now (will be populated as each module adds its models in later sprints).
- `main.py`:
  - FastAPI app instance
  - CORS middleware (allow frontend origin — read from env, default `http://localhost:3000` for dev)
  - `@app.on_event("startup")` → connects to MongoDB
  - `GET /health` → returns `{"status": "ok", "db": "<connected|disconnected>"}` (actually pings Mongo)
  - Empty `modules/` folder structure created (just `__init__.py` files) for: `auth`, `users`, `expenses`, `income`, `groups`, `budgets`, `analytics`, `notifications`, `websocket` — so the folder layout from TRD.md §3 exists, ready for Sprint 2+ to fill in.
- `Dockerfile` — multi-stage if helpful, but simple is fine: Python 3.11-slim base, copy requirements, pip install, copy app, `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`.
- `.env.example` listing all variables from `TRD.md` §10.4 (values blank/placeholder).

### 3. Frontend Skeleton (`frontend/`)
- `npx create-next-app@latest` with: TypeScript, Tailwind CSS, App Router, `src/` directory NOT used (keep `app/` at root of `frontend/` per TRD.md structure), ESLint.
- Install: `zustand`, `@tanstack/react-query`, `recharts`, `react-hook-form`, `zod`, `@hookform/resolvers`.
- Initialize shadcn/ui (`npx shadcn-ui@latest init`) with a clean neutral base theme (don't over-design yet — `frontend-design` skill guidance applies starting Sprint 3 when real UI is built).
- `lib/api/client.ts` — a placeholder Axios or fetch wrapper pointing to `process.env.NEXT_PUBLIC_API_BASE_URL`, with a TODO comment for the auth interceptor (built in Sprint 3).
- Basic `app/page.tsx` — simple placeholder landing page (e.g., "FinTrack — Coming Soon" with a link styled as a button, no real content yet).
- `.env.local.example` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` and `NEXT_PUBLIC_WS_URL=ws://localhost:8000`.

### 4. Docker & Nginx
- Root `docker-compose.yml` exactly per `TRD.md` §10.3 (backend service only — frontend is NOT dockerized, it deploys to Vercel).
- Root `nginx.conf` per `TRD.md` §10.2 (this won't be used until Sprint 10's EC2 deploy, but scaffold it now so it's version-controlled from the start).

### 5. Playwright Setup (`tests/`)
- `npm init playwright@latest` (or manual setup) in a way that works from the monorepo root or a `tests/` package — your choice, document which in Handoff Notes.
- `playwright.config.ts` per `TRD.md` §11.1.
- `tests/fixtures/` folder created (empty, will hold `loginAsTestUser()` etc. starting Sprint 3).
- One trivial smoke test: `tests/smoke.spec.ts` that visits `/` and checks the placeholder page loads — just to confirm Playwright itself works end-to-end.

### 6. Verification (Local)
- `cd backend && uvicorn main:app --reload` → `curl http://localhost:8000/health` returns `{"status": "ok", "db": "connected"}` (requires `.env` filled with real MongoDB URI from Krishna).
- `cd frontend && npm run dev` → `http://localhost:3000` loads the placeholder page.
- `npx playwright test` → smoke test passes.
- `docker compose build backend && docker compose up backend` → container starts, `/health` reachable on `localhost:8000`.

### 7. Git
- Commit and push the full scaffold to the GitHub repo from `Manual-Setup.md` §2.
- Sensible commit message, e.g. `chore: initial monorepo scaffold (backend, frontend, docker, playwright)`.

---

## Definition of Done

- [ ] Monorepo structure matches `TRD.md` §10.6
- [ ] Backend `/health` returns 200 with live MongoDB connection confirmed
- [ ] Frontend dev server runs and shows placeholder page
- [ ] Backend Dockerfile builds and runs successfully
- [ ] `docker-compose up backend` works
- [ ] Playwright installed, config present, smoke test passes
- [ ] All `.env.example` / `.env.local.example` files present and documented
- [ ] `.gitignore` correctly excludes secrets and build artifacts (verify `.env` is NOT in the git history)
- [ ] Everything pushed to GitHub

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 1 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- [e.g., "Playwright tests live in /tests at monorepo root, run via `npx playwright test` from root"]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 2 needs to know:**
- Backend module folder structure is at `backend/modules/` with empty `__init__.py` files
  for: auth, users, expenses, income, groups, budgets, analytics, notifications, websocket
- `core/config.py` Settings class is ready to extend with new env vars as needed
- `core/database.py` has an empty `document_models=[]` — Sprint 2 must add User/OTP/
  RefreshToken Beanie models to this list
- MongoDB database name in use: `fintrack`
```
