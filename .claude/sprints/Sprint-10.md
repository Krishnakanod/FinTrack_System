# Sprint 10 — E2E Polish, Deployment & Documentation

**Layer:** Both (mostly configuration/deployment, not new feature code)
**Depends on:** All previous sprints (1-9)
**Estimated files touched:** ~8-10 (mostly config + README + bugfixes)

---

## Context to Read First

1. `docs/TRD.md` — Section 10 (full Deployment Architecture — re-read this fully, it's the spec for this entire sprint)
2. `docs/Manual-Setup.md` — Section 5 (AWS EC2), Section 6 (Vercel) — **confirm Krishna has completed these.** If EC2 instance isn't launched yet, STOP and ask Krishna to do so before continuing (you cannot provision AWS resources yourself — you can only provide the exact commands to run).
3. **Read ALL previous sprints' Handoff Notes** (Sprint 1 through 9) — collect every "Known issues / deferred items" entry into a punch-list for this sprint to address.
4. `docs/Implementation-Plan.md` — Section 6, Sprint 10 summary

---

## Goal

Run a full end-to-end Playwright test covering the entire user journey, deploy the backend to AWS EC2 via Docker + Nginx, deploy the frontend to Vercel, smoke-test the live production deployment, fix any bugs surfaced during this final pass, and write the project README.

---

## Tasks

### 1. Collect the Punch List
- Go through every sprint's Handoff Notes (1-9) and list every "Known issues / deferred items" entry in one place at the top of this sprint's working notes. Triage: fix now if small, document as a known limitation in the README if out of scope for v1.

### 2. Full End-to-End Playwright Test (`tests/full-flow.spec.ts`)
Write one comprehensive test simulating a realistic full session, covering (in order):
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
11. Set a budget for a category already exceeded by step 2's expense → trigger evaluation (use the test-only short interval trick from Sprint 8 if the scheduler isn't naturally due) → assert notification appears
12. Visit analytics page → assert chart data is present
13. Download a PDF report → assert file downloads successfully
14. Logout → assert redirected to login

This test should expose any integration gaps between modules built in different sprints/sessions — **run it and fix anything that breaks** before moving to deployment.

### 3. Backend Deployment to AWS EC2

SSH into the EC2 instance (per `Manual-Setup.md` §5) and run:
```bash
# On the EC2 instance (Ubuntu 22.04)
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx git
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker $USER   # log out/in or `newgrp docker` after this

git clone <your-repo-url> fintrack
cd fintrack

# Create .env with real production secrets (NOT committed to git)
nano .env   # paste all values from Manual-Setup.md §8 secrets checklist

docker compose build backend
docker compose up -d backend

# Verify
curl http://localhost:8000/health
```

### 4. Nginx Configuration on EC2
```bash
sudo cp nginx.conf /etc/nginx/sites-available/fintrack
sudo ln -s /etc/nginx/sites-available/fintrack /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default   # remove default site if present
sudo nginx -t   # test config syntax
sudo systemctl restart nginx
```
- Update `nginx.conf`'s `server_name` to the actual EC2 public IP or domain before copying.
- Verify from your local machine: `curl http://<ec2-public-ip>/api/v1/health` (or whatever health path you exposed) and confirm a WebSocket test connects through Nginx successfully (per `App-Flow.md` §12 — this is a common point of failure, test it specifically).

### 5. (Optional but recommended) HTTPS via Let's Encrypt
If Krishna wants real `https://`/`wss://` instead of `http://`/`ws://` (recommended, since Vercel's frontend will be HTTPS and mixed-content blocking can break API calls from the browser):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>   # requires Krishna to own/point a domain at the EC2 IP
```
If Krishna doesn't have a domain, document this as a known limitation (frontend and backend on different protocols/origins — may need Vercel rewrite rules or accept mixed-content browser warnings for the portfolio demo). Flag this clearly for Krishna to decide.

### 6. Frontend Deployment to Vercel
1. In the Vercel dashboard, import the GitHub repo.
2. Set the project's **Root Directory** to `frontend/` (monorepo support).
3. Set environment variables:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://<ec2-domain-or-ip>
   NEXT_PUBLIC_WS_URL=wss://<ec2-domain-or-ip>
   ```
4. Deploy. Verify build succeeds.
5. Update backend's CORS allowed origins (`core/config.py` / `main.py` CORS middleware from Sprint 1) to include the real Vercel production URL — redeploy backend if this requires a code change.

### 7. Production Smoke Test
- Visit the live Vercel URL.
- Run through: signup, login, add expense, create group, add transaction, verify real-time update works in production (open two browser windows/profiles), download a report.
- Specifically re-verify the WebSocket connection works through the full chain (Vercel frontend → EC2 Nginx → FastAPI) since this is the path most likely to break in production that worked fine in local dev.

### 8. README.md
Write a proper project README covering:
- Project overview (1-2 paragraphs, portfolio-friendly framing — this is what recruiters will read first)
- Tech stack summary
- Architecture diagram (can reuse `TRD.md` §1's ASCII diagram or describe it)
- Key features list (from `PRD.md` §2.3)
- Local development setup instructions (clone, env vars, run backend, run frontend, run tests)
- Live demo link (Vercel URL)
- Screenshots (Krishna should add these manually, or note where to insert them)
- Known limitations (anything punch-listed in Task 1 that wasn't fixed)

### 9. Final Git Cleanup
- Ensure `.env` files were never committed (double-check git history if paranoid: `git log --all --full-history -- "*.env"`)
- Tag the release: `git tag v1.0.0 && git push --tags`

---

## Definition of Done

- [ ] `tests/full-flow.spec.ts` passes locally against the dev environment
- [ ] Backend running on EC2 via Docker, reachable via Nginx
- [ ] WebSocket connections work through the full Nginx proxy chain
- [ ] Frontend deployed to Vercel, environment variables set correctly
- [ ] CORS configured to allow the production frontend origin
- [ ] Full production smoke test passes, including real-time group transaction updates across two browser sessions
- [ ] Report download works in production
- [ ] README.md written and complete
- [ ] No secrets committed to git (verified)
- [ ] All punch-list items from Task 1 either fixed or explicitly documented as known limitations

---

## Handoff Notes (Project Complete — Final Summary)

```markdown
### Sprint 10 Handoff Notes — PROJECT COMPLETE

**Live URLs:**
- Frontend: [Vercel URL]
- Backend: [EC2 URL]

**Final known limitations:**
- [list anything punch-listed but not fixed, e.g. HTTPS/domain situation if no
  domain was available]

**Post-v1 ideas (not in scope, for Krishna's own future reference):**
- [anything that came up during development worth noting for a v2]
```
