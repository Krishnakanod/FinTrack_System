Properly close out the current sprint by writing an accurate, verified "Handoff Notes"
section into that sprint's doc. This command exists because Handoff Notes are the *only*
continuity mechanism between sessions — a sloppy or optimistic handoff actively damages
the next session's ability to work correctly.

**Usage:** `/handoff <sprint-number>` (e.g. `/handoff 4`). If no number is given, ask
Krishna which sprint just finished — do not infer it from recent file changes alone,
since that can be misleading (confirm with Krishna first).

---

## Step 1 — Identify the Sprint

Open `.claude/sprints/Sprint-<NN>.md` for the specified number. Locate its "Definition of
Done" checklist and its "Handoff Notes" template at the bottom. Also open
`.claude/specs/Spec-<NN>.md` for the same number — its §1 "Locked Contracts" and §2
"Acceptance Scenarios" are what you'll verify against in Step 2.

## Step 2 — Verify Against Actual Work, Don't Just Ask

Do not simply ask Krishna "did everything work?" and write down the answer. Actually
verify:

1. Go through the sprint's **Definition of Done** checklist item by item. For each item,
   check the actual repo state (read the relevant files, check for the relevant
   endpoints/components) to determine if it's genuinely done — don't assume yes.
2. Go through `Spec-<NN>.md`'s **§2 Acceptance Scenarios** one by one. For each
   Given/When/Then, check whether the actual implementation satisfies it — exact field
   names, status codes, and locked numeric values from §1 included. This is a stricter,
   more granular pass than the Definition of Done checklist and will often catch things
   the checklist alone misses (e.g. a correct-looking endpoint that returns the wrong
   error code on a specific edge case).
3. If the sprint doc included curl verification commands, re-run them now if a backend
   is available locally, to confirm endpoints actually respond as expected — and confirm
   the response shapes match `Spec-<NN>.md` §1 exactly, not just "looks roughly right."
4. If the sprint doc included Playwright tests, run them (`npx playwright test
   <relevant-spec>`) if the environment allows, and report actual pass/fail — don't
   guess.
5. Cross-check any "Open Implementation Choices" from `Spec-<NN>.md` §4 — confirm what
   was actually implemented for each, not what was planned.

## Step 3 — Ask Krishna to Confirm Anything You Can't Verify Yourself

Some things (e.g. "did the email actually arrive in your inbox", "did you manually test
the OCR with a real photo") can't be verified by reading code alone. For these, ask
Krishna directly rather than assuming success. List exactly what you need confirmed.

## Step 4 — Write the Handoff Notes

Replace the blank template at the bottom of `.claude/sprints/Sprint-<NN>.md` with a real,
specific Handoff Notes section. Required qualities:

- **"What was built"** — a concrete list, not a vague restatement of the sprint goal.
- **"Decisions made"** — every place the sprint doc said "your call, document this"
  must have an actual answer here, not be skipped.
- **"Known issues / deferred items"** — be honest. If something from the Definition of
  Done checklist is NOT actually done, it goes here explicitly, not glossed over. If
  truly nothing is outstanding, say "None" explicitly rather than leaving it blank.
- **"What Sprint N+1 needs to know"** (and any other specific future sprint called out
  in the original template, e.g. some sprints have notes for two different future
  sprints) — concrete details: exact file paths, exact function signatures, exact JSON
  shapes, not generic statements like "the API is ready."

Do not write a Handoff Notes section that just says "everything works as expected" with
no specifics — this is explicitly not acceptable, per `CLAUDE.md` Section 5. A future
session reading this needs enough detail to NOT have to re-read all your code from
scratch to understand what's there.

## Step 5 — Flag Incomplete Sprints Clearly

If verification in Step 2 reveals the sprint is NOT actually complete (some Definition
of Done items fail), say so plainly to Krishna:

```
Sprint <N> is not fully complete. The following Definition of Done items are not met:
  - [item]: [why]
  - [item]: [why]

I've written Handoff Notes reflecting this accurately, marked as "INCOMPLETE" at the
top, with a clear note on exactly where to resume. I'd recommend NOT starting Sprint
<N+1> until these are resolved, since [explain dependency risk if applicable, e.g.
"Sprint 7 imports get_current_user which depends on this"].
```

Do not silently mark an incomplete sprint as done to make the handoff look clean.

## Step 6 — Confirm Before Saving

Show Krishna the drafted Handoff Notes section before writing it to the file, in case
they want to correct or add anything you couldn't verify yourself. Once confirmed, save
it into `.claude/sprints/Sprint-<NN>.md`, replacing the template placeholder.
