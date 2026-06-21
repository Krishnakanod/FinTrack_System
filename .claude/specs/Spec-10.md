# Spec-10 — E2E Polish, Deployment & Documentation

**Companion sprint doc:** `.claude/sprints/Sprint-10.md`
**Prerequisite reading:** ALL previous sprints' Handoff Notes (1-9) — this sprint's punch-list step depends on having actually read every one, not skimmed.

---

## 1. Locked Contracts

### 1.1 Full E2E Test File Name and Location (Locked)
```
tests/full-flow.spec.ts
```

### 1.2 Full E2E Test — Exact Step Sequence (Locked Order, from Sprint-10.md Task 2)
The single comprehensive test must execute these steps in this exact order, each as a distinct, individually-assertable step (use Playwright's `test.step()` wrapper for each numbered item so failures are easy to localize):
```
1. Signup new user A → verify OTP → land on dashboard
2. Add a manual expense → appears on dashboard
3. Upload a receipt via OCR → confirm → appears on dashboard
4. Add income → net balance updates
5. Signup user B (second browser context)
6. User A adds User B as a friend
7. User A creates a group with User B
8. User A adds a group transaction, split equally
9. Assert User B's open session receives the real-time update
10. Check balances page reflects the new debt correctly
11. Set a budget for a category already exceeded by step 2's expense → trigger
    evaluation → assert notification appears
12. Visit analytics page → assert chart data is present
13. Download a PDF report → assert file downloads successfully
14. Logout → assert redirected to login
```
**Step 11's "trigger evaluation" (locked approach):** since waiting a real hour for APScheduler is impractical for a test run, this step must either (a) temporarily expose a test-only endpoint or internal hook to force-run `evaluate_budgets()` immediately, or (b) configure a very short scheduler interval specifically in the test/CI environment via an environment variable — **pick one approach and document it clearly**, and ensure whichever mechanism you use is NOT present/active in the production deployment (§1.5 below has a hard requirement that the production interval is `hours=1`).

### 1.3 EC2 Provisioning Commands (Locked, from Sprint-10.md Task 3 — restated here as the binding command sequence)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx git
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker $USER

git clone <your-repo-url> fintrack
cd fintrack
nano .env   # paste production secrets per Manual-Setup.md §8

docker compose build backend
docker compose up -d backend
curl http://localhost:8000/health
```
Do not substitute alternative package managers or container runtimes (e.g. Podman) without confirming with Krishna first.

### 1.4 Nginx Production Config — Exact File Application (Locked)
```bash
sudo cp nginx.conf /etc/nginx/sites-available/fintrack
sudo ln -s /etc/nginx/sites-available/fintrack /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```
The deployed `nginx.conf`'s `server_name` directive MUST be updated from the placeholder to the actual EC2 public IP or domain before this copy step — verify this substitution was made, don't deploy the literal placeholder string.

### 1.5 Production Scheduler Interval — Hard Requirement (Locked)
The deployed backend's `modules/budgets/scheduler.py` MUST have `@scheduler.scheduled_job("interval", hours=1)` exactly — not a test-shortened interval, regardless of what mechanism was used for Scenario 1.2/step 11's test acceleration. This is checked explicitly in this sprint's Definition of Done and must be verified by reading the actual deployed code, not assumed.

### 1.6 CORS Production Origin (Locked Requirement)
`core/config.py`'s `cors_allowed_origins` setting (established in Spec-01 §1.4/§1.9) must be updated in the production `.env` to include the real Vercel deployment URL (e.g. `https://fintrack-xyz.vercel.app`), exactly matching what Vercel assigns — not a guessed or placeholder URL. If a custom domain is later attached to Vercel, this value needs updating again, but for this sprint, use whatever URL Vercel actually provides after deployment.

### 1.7 Vercel Environment Variables (Locked Names, Values per Manual-Setup.md)
```
NEXT_PUBLIC_API_BASE_URL=https://<ec2-domain-or-ip>
NEXT_PUBLIC_WS_URL=wss://<ec2-domain-or-ip>
```
Exact variable names locked (must match what every `lib/api/*.ts` file and `lib/websocket.ts` already reference from earlier sprints — do not introduce new env var names at deployment time).

### 1.8 README.md — Required Sections (Locked Structure, Content Your Choice)
```markdown
# FinTrack
## Overview
## Tech Stack
## Architecture
## Features
## Local Development Setup
## Live Demo
## Screenshots
## Known Limitations
```
All 8 section headers must be present, in this order. Content under each is Krishna/your choice, per Sprint-10.md Task 8.

### 1.9 Git Release Tag (Locked Command)
```bash
git tag v1.0.0
git push --tags
```

---

## 2. Acceptance Scenarios

### Scenario 10.1 — Full E2E test passes locally
```gherkin
Given the local dev environment is fully running (backend, frontend, MongoDB reachable)
When I run `npx playwright test full-flow.spec.ts`
Then all 14 steps (per §1.2) pass
And the test produces a clear step-by-step report (via test.step()) showing which
  numbered step succeeded/failed, not just a single pass/fail for the whole file
```

### Scenario 10.2 — Two-context real-time step within the full flow
```gherkin
Given User A and User B both have active sessions in the full-flow test (two
  separate Playwright browser contexts, per step 5)
When User A completes step 8 (adds a group transaction)
Then step 9's assertion confirms User B's already-open page reflects the update
  without User B's context performing any explicit refresh action
```

### Scenario 10.3 — Backend health check succeeds from EC2
```gherkin
Given the backend container is running on the EC2 instance
When I run `curl http://localhost:8000/health` directly on the EC2 instance
Then I receive 200 with { "status": "ok", "db": "connected" }
```

### Scenario 10.4 — Backend reachable through Nginx from outside EC2
```gherkin
Given Nginx is configured and running per §1.4
When I run `curl http://<ec2-public-ip>/api/v1/...` (any real endpoint) from my
  local machine (NOT the EC2 instance itself)
Then I receive a valid API response (proving the reverse proxy works end-to-end)
```

### Scenario 10.5 — WebSocket connects through the full Nginx proxy chain
```gherkin
Given Nginx is configured with the /ws/ location block per TRD.md §10.2
When a WebSocket client connects to ws://<ec2-public-ip>/ws/{user_id}?token=<valid token>
  from outside the EC2 instance
Then the connection succeeds and events can be sent/received
  (this specifically validates the Upgrade/Connection headers are being proxied
  correctly — a common point of failure not caught by simple HTTP curl tests)
```

### Scenario 10.6 — Frontend deployed and reachable on Vercel
```gherkin
Given the Vercel project is configured per §1.7
When I visit the live Vercel URL in a browser
Then the FinTrack login page loads without console errors
And no mixed-content warnings appear (if HTTPS/WSS were configured per
  Sprint-10.md Task 5) OR mixed-content limitations are explicitly documented
  in the README's Known Limitations section if HTTPS was not set up
```

### Scenario 10.7 — Full production smoke test
```gherkin
Given the app is fully deployed (backend on EC2, frontend on Vercel)
When I manually walk through: signup, login, add expense, create group, add
  transaction, verify real-time update (two browser windows/profiles), download
  a report
Then every step succeeds against the LIVE production URLs (not localhost)
```

### Scenario 10.8 — No secrets in git history
```gherkin
When I run `git log --all --full-history -- "*.env"` from the repo root
Then there is no output
```

### Scenario 10.9 — Production scheduler interval verified
```gherkin
When I inspect the actual deployed `modules/budgets/scheduler.py` on the EC2
  instance (e.g. via `docker exec` into the running container, or by checking
  the source that was built into the image)
Then the scheduled_job interval is confirmed as hours=1, not a test-shortened value
```

---

## 3. Explicitly Out of Scope for This Sprint
- New feature development of any kind — this sprint is exclusively testing, deployment, bugfixing discovered issues, and documentation
- Setting up CI/CD pipelines (GitHub Actions, etc.) — not in PRD/TRD scope, deployment is manual per `Manual-Setup.md`

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Which mechanism was used for test-acceleration of the budget scheduler in step 11 (§1.2)
- Whether HTTPS/Let's Encrypt was set up (Sprint-10.md Task 5 is optional/conditional on Krishna owning a domain) — document the final state either way
- Final punch-list resolution: for each item collected from Sprints 1-9's Handoff Notes (per Sprint-10.md Task 1), document whether it was fixed in this sprint or deferred to the README's Known Limitations

---

*End of Spec-10.md*
