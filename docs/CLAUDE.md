# FinTrack — Project Instructions for Claude Code

**This file is read automatically at the start of every Claude Code session in this repo.**
It applies regardless of which slash command (if any) is used. Read it in full before
touching any file, running any command, or writing any code.

---

## 0. What This Project Is

FinTrack is a full-stack personal finance tracker + bill-splitter, built solo by Krishna
across multiple independent Claude Code sessions ("sprints"). Each sprint is a **separate
session with zero memory of previous sessions** — the only continuity between sessions is
the documentation in `docs/`. Treat every session as if you have just been hired onto an
existing codebase and must orient yourself entirely from the docs and the code on disk —
never from assumed context.

Full specs live in:
- `docs/PRD.md` — what to build and why (user stories, acceptance criteria)
- `docs/TRD.md` — how to build it (architecture, schema, API contracts) — **this is the
  single source of truth for technical decisions**
- `docs/App-Flow.md` — exact step-by-step data flow for every feature
- `docs/Implementation-Plan.md` — sprint roadmap and dependency graph
- `docs/Manual-Setup.md` — what Krishna handles outside Claude Code (accounts, API keys)
- `.claude/sprints/Sprint-XX.md` — the spec for one specific session's tasks, including the
  previous sprint's "Handoff Notes" — tells you WHAT to build and WHY
- `.claude/specs/Spec-XX.md` — the binding CONTRACT for that same sprint: exact field names,
  request/response JSON shapes, status codes, error codes, locked business rules, and
  Given/When/Then acceptance scenarios — tells you the EXACT shape of what to build.
  Always read the matching `Spec-XX.md` alongside `Sprint-XX.md`; never one without the
  other.

---

## 1. The Single Most Important Rule: DO NOT ASSUME, ASK

This rule overrides your default instinct to be maximally autonomous. It applies for the
**entire session**, not just at the start.

- If a requirement is ambiguous, underspecified, or could reasonably be implemented two
  different ways, **stop and ask Krishna** before writing code. Do not silently pick the
  interpretation that seems most likely or most convenient to implement.
- If a sprint doc references a decision from a previous sprint's Handoff Notes and that
  section is missing, blank, or contradicts what you find in the actual code on disk,
  **stop and ask** rather than guessing which one is correct.
- If you discover the actual codebase has diverged from what the docs describe (e.g. a
  function signature changed, a file moved, a different library got used), **stop and
  ask** how Krishna wants to proceed — do not just silently work around the discrepancy
  or silently "correct" the docs without confirming.
- If a task could be done in a way that's faster/easier for you but deviates from the
  architecture in `TRD.md` (e.g. adding a new service, a new database, a new top-level
  dependency not listed in the tech stack), **stop and ask** before doing it — even if
  you believe it's a better approach. Propose it, don't just do it.
- Asking a clarifying question is never a failure. Writing code on a wrong assumption
  and having to redo it costs far more of Krishna's time than asking up front.

**What "ask" looks like in practice:** end your analysis with a clearly marked list of
numbered questions, and wait for Krishna's answers before writing or modifying any file.
Do not pre-emptively write "draft" code while waiting "just in case" — wait for real
answers first.

This rule applies whether you were invoked via a slash command below or simply asked to
do something ad hoc in this repo.

---

## 2. Mandatory Boot Sequence (Every Session, Before Any Code)

Whenever a new Claude Code session starts in this repo — whether invoked via `/sprint`,
`/status`, `/handoff`, or just a freeform request — do the following before writing or
editing a single file:

1. **Read `docs/PRD.md`** in full (or at minimum the Executive Summary + the section
   relevant to the task at hand if PRD is large — but when in doubt, read it fully).
2. **Read `docs/TRD.md`** in full. This is the architecture contract. Never violate it
   without explicit confirmation from Krishna.
3. **Read `docs/App-Flow.md`** sections relevant to the feature(s) in scope.
4. **Inspect the actual repo state** — run `git log --oneline -20`, look at the current
   folder structure (`backend/modules/`, `frontend/app/`), and skim any files directly
   relevant to the task. Do not trust the docs alone to describe the current state of the
   code — verify against what's actually on disk, since docs can lag behind reality if a
   previous session deviated from plan (and should have documented that in Handoff Notes,
   but may not have).
5. **If working on a specific sprint**, read that sprint's doc in `.claude/sprints/` AND
   the matching `.claude/specs/Spec-XX.md` (the binding contract — exact field names,
   status codes, locked business rules, acceptance scenarios) AND the previous sprint's
   "Handoff Notes" section at the bottom of its doc. Treat anything `Spec-XX.md` marks
   as "locked" as non-negotiable without confirming with Krishna first.
6. **Summarize your understanding back to Krishna** before starting: what you're about to
   build, which files you expect to touch, and any assumptions you are NOT sure about.
7. **Ask clarifying questions** (per Section 1 above) for anything ambiguous. Wait for
   answers.
8. Only after Krishna confirms or answers your questions, begin implementation.

This sequence is not optional and is not satisfied by skimming. If a sprint doc is long,
that is intentional — it was written to prevent exactly the kind of rework that comes
from a fresh session guessing instead of reading.

---

## 3. Architecture Guardrails (Quick Reference — TRD.md is Authoritative)

- **Backend:** ONE FastAPI app (modular monolith), domain modules under `backend/modules/`,
  calling each other via direct Python function calls — never internal HTTP.
- **Database:** ONE MongoDB Atlas database (`fintrack`), one collection per domain.
- **Frontend:** ONE Next.js 14 app, deployed to Vercel.
- **Real-time:** Native WebSockets, in-process `ConnectionManager`, no external pub/sub.
- **No new services, databases, or major dependencies** without explicit confirmation —
  see Section 1.

---

## 4. Available Slash Commands

| Command | Purpose |
|---|---|
| `/sprint <number>` | Start work on a specific sprint (e.g. `/sprint 4`). Runs the full boot sequence, reads that sprint's doc + prior Handoff Notes, asks clarifying questions, then implements only after confirmation. |
| `/status` | Quick orientation only — reports current repo state vs. the sprint roadmap, does NOT start implementing anything. Use this if Krishna just wants a status check. |
| `/handoff` | Closes out the current sprint properly — reviews what was actually built (by diffing against the sprint's Definition of Done), and writes a complete, accurate Handoff Notes section back into that sprint's doc. Refuses to write a vague/incomplete handoff. |

Even without using a slash command, any freeform instruction in this repo should still
follow Sections 1 and 2 above.

---

## 5. Tone & Working Style

- Be direct about risk: if something in a sprint doc looks like it will cause a problem
  later (e.g. a schema decision that conflicts with a later sprint's stated needs), say
  so before implementing it, even if it's not your place to redesign the plan.
- Prefer small, verifiable steps with curl/manual checks (per each sprint doc's
  "Verification" section) over large unverified batches of code.
- Fill out Handoff Notes honestly — including incomplete work, deviations from the doc,
  and anything the next session needs to know. A Handoff Notes section that just says
  "everything works" without specifics is not acceptable.
