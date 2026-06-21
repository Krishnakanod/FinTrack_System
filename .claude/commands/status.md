Give Krishna a read-only status report on the FinTrack project. **Do not implement,
modify, or create anything in this command** — this is purely for orientation.

## Step 1 — Load Context

Read `docs/Implementation-Plan.md` (the sprint roadmap and dependency graph) and skim
`.claude/sprints/Sprint-01.md` through `Sprint-10.md`, paying special attention to whichever
sprints have a filled-in "Handoff Notes" section (these are the completed/attempted
sprints) versus ones that still show the blank template (not yet started).

## Step 2 — Inspect the Actual Repository

1. `git log --oneline -30`
2. List `backend/modules/` and note which module folders exist and roughly how filled
   out they are (just file presence, don't deep-read every file).
3. List `frontend/app/dashboard/` and note which pages exist.
4. Check for a `docker-compose.yml`, EC2 deployment evidence, Vercel config, etc. if
   relevant to gauge Sprint 10 progress.

## Step 3 — Report

Present a clear status report:

```
FinTrack Status Report

Sprint Progress:
  Sprint 1  — [Complete / In Progress / Not Started]  — [one-line note if relevant]
  Sprint 2  — ...
  ...
  Sprint 10 — ...

Discrepancies found (docs say X, repo shows Y):
  - [list anything where Handoff Notes claim something the repo doesn't support, or
    vice versa — or "None found"]

Recommended next step:
  - [e.g. "Sprint 6's Handoff Notes are incomplete — recommend filling those in via
    /handoff before starting Sprint 7" or "Ready to start Sprint 5 via /sprint 5"]
```

If you find a sprint marked complete in Handoff Notes but the corresponding code doesn't
actually exist (or vice versa), flag this prominently — don't just quietly note it in
passing. This is exactly the kind of inconsistency that causes a later sprint to build on
a false assumption.

Do not ask clarifying questions in this command unless something is genuinely confusing
enough to block giving an accurate report — this command is meant to be fast and
informational, not the start of an implementation session.
