# Spec-01 — Project Scaffold & Infrastructure

**Companion sprint doc:** `.claude/sprints/Sprint-01.md`
**Read order:** `Sprint-01.md` tells you WHAT to do and WHY. This document tells you the EXACT CONTRACT each piece must satisfy. Where this document gives an exact name/shape/status code, it is locked — do not deviate without asking Krishna. Where it says "your choice," normal engineering judgment applies and should be recorded in Handoff Notes.

---

## 1. Locked Contracts

### 1.1 `GET /health`
**Request:** none.
**Response — 200 OK:**
```json
{ "status": "ok", "db": "connected" }
```
**Response — 200 OK (DB down):**
```json
{ "status": "ok", "db": "disconnected" }
```
> Note: the endpoint itself still returns HTTP 200 even if DB is disconnected — it's a liveness probe for the app process, with `db` field reporting dependency health. Do not return a non-200 status for DB-down; that would make basic process monitoring conflate "app crashed" with "DB hiccup."

### 1.2 Environment Variables (`.env.example` — backend)
Exact variable names, all required from Sprint 1 onward even if unused until later sprints:
```
MONGODB_URI=
MONGODB_DB_NAME=fintrack
JWT_SECRET=
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
GMAIL_USER=
GMAIL_APP_PASSWORD=
GOOGLE_VISION_API_KEY=
CORS_ALLOWED_ORIGINS=http://localhost:3000
```
**Do not rename any of these keys in later sprints** — every sprint doc assumes these exact names when referencing `core/config.py`'s `Settings` class.

### 1.3 Environment Variables (`.env.local.example` — frontend)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 1.4 `core/config.py` — Settings Class Contract
Must expose a singleton-style `settings` object (however you choose to construct it — `pydantic-settings` `BaseSettings` subclass instantiated once) with attributes matching the env var names in lowercase snake_case, e.g. `settings.mongodb_uri`, `settings.jwt_secret`, `settings.jwt_access_ttl_minutes`. **Every future sprint imports `from core.config import settings` and references attributes by these exact names** — do not use a different access pattern (e.g. `os.environ` directly) anywhere outside `core/config.py` itself.

### 1.5 `core/database.py` — Contract
Must expose:
- A function or startup hook that initializes Beanie against the `fintrack` database using `settings.mongodb_uri` and `settings.mongodb_db_name`.
- A mutable list/registry named `document_models` that starts empty in Sprint 1 and that future sprints append their Beanie `Document` subclasses to. **The exact name `document_models` is locked** since every future sprint's spec references it by this name when instructing "register in `core/database.py`'s `document_models`."

### 1.6 Backend Module Folder Stubs
Exactly these folders must exist under `backend/modules/`, each containing only an empty (or near-empty) `__init__.py` at the end of Sprint 1 — no logic yet:
```
auth/  users/  expenses/  income/  groups/  budgets/  analytics/  notifications/  websocket/
```
Folder names are locked exactly as spelled above (lowercase, plural where shown) — every subsequent sprint spec references these exact folder names in import paths.

### 1.7 Monorepo Root Structure
Locked top-level layout (already specified in `TRD.md` §10.6 — restated here as the binding contract for this sprint specifically):
```
fintrack/
├── frontend/
├── backend/
├── tests/
├── docker-compose.yml
├── nginx.conf
├── docs/
└── README.md
```

### 1.8 Docker
- `backend/Dockerfile` must produce an image that runs `uvicorn main:app --host 0.0.0.0 --port 8000` as its entrypoint/CMD.
- `docker-compose.yml` must define exactly one service named `backend`, matching `TRD.md` §10.3 verbatim:
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    restart: always
```

### 1.9 CORS
`main.py` must configure CORS middleware allowing the origin(s) listed in `settings.cors_allowed_origins` (comma-split if you choose to support multiple). Default dev value is `http://localhost:3000`. This will be revisited in Sprint 10 to add the production Vercel URL — do not hardcode `localhost:3000` directly in `main.py`; it must come from settings so Sprint 10 can change it via env var alone.

### 1.10 Playwright
- Config file: `playwright.config.ts`, contents must match `TRD.md` §11.1 exactly (testDir `./tests`, baseURL `http://localhost:3000`, chromium-only project).
- Smoke test file: `tests/smoke.spec.ts`.

---

## 2. Acceptance Scenarios

### Scenario 1.1 — Backend health check, DB connected
```gherkin
Given the backend is running with a valid MONGODB_URI in .env
And MongoDB Atlas is reachable
When I send GET /health
Then I receive HTTP 200
And the JSON body is exactly { "status": "ok", "db": "connected" }
```

### Scenario 1.2 — Backend health check, DB unreachable
```gherkin
Given the backend is running with an invalid/unreachable MONGODB_URI
When I send GET /health
Then I receive HTTP 200 (not 500 — see §1.1 note)
And the JSON body is { "status": "ok", "db": "disconnected" }
```

### Scenario 1.3 — Frontend placeholder loads
```gherkin
Given the frontend dev server is running (npm run dev)
When I navigate to http://localhost:3000/
Then the page loads without console errors
And some visible text confirms this is the FinTrack app (exact copy is your choice)
```

### Scenario 1.4 — Docker build and run
```gherkin
Given I am in the monorepo root
When I run `docker compose build backend && docker compose up backend`
Then the container starts without crashing
And GET http://localhost:8000/health from the host machine returns 200
```

### Scenario 1.5 — Playwright smoke test
```gherkin
Given the frontend dev server is running
When I run `npx playwright test smoke.spec.ts`
Then the test passes
```

### Scenario 1.6 — Secrets not committed
```gherkin
Given the repository has been pushed to GitHub
When I run `git log --all --full-history -- "*.env"` from the repo root
Then there is no output (no .env file ever committed)
And only .env.example / .env.local.example exist in git history
```

---

## 3. Explicitly Out of Scope for This Sprint

Do not implement any of the following yet — they belong to later sprints and pulling them forward will create merge/handoff confusion:
- Any actual auth logic (Sprint 2)
- Any database models beyond the empty `document_models` list (Sprint 2+)
- Any real frontend pages beyond the single placeholder (Sprint 3+)
- Nginx is scaffolded as a file but NOT applied/tested against a real server yet (Sprint 10)

---

## 4. Open Implementation Choices (Your Judgment — Document in Handoff Notes)

- Whether `tests/` is its own npm package (separate `package.json`) or shares the frontend's — either is fine, but state which.
- Exact wording/styling of the frontend placeholder page.
- Whether the email utility stub (if you choose to scaffold its file location now) lives at `core/email.py` or inside `modules/auth/` — Sprint 2 will actually build it, but if you want to create an empty file now for folder-structure clarity, document where.

---

*End of Spec-01.md*
