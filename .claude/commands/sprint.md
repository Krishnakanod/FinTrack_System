Start a focused work session on a specific FinTrack sprint.

**Usage:** `/sprint <number>` (e.g. `/sprint 4`). If no number is given, ask Krishna
which sprint number to work on before doing anything else — do not guess based on repo
state.

You are operating as a fresh Claude Code session with **no memory of any previous
session**. Everything you need to know must come from reading the docs and inspecting
the actual repository. Follow the steps below in order. Do not skip ahead to
implementation at any point before Step 7 explicitly says you may.

---

## Step 1 — Load Core Context

Read in full:
1. `docs/PRD.md`
2. `docs/TRD.md`
3. `docs/App-Flow.md`
4. `docs/Implementation-Plan.md` (at minimum the dependency graph and the summary for
   the requested sprint number)

Do not summarize these back yet — just load them into context.

## Step 2 — Load the Target Sprint

1. Open `.claude/sprints/Sprint-<NN>.md` for the requested sprint number (zero-padded,
   e.g. `Sprint-04.md`).
2. Read its full "Context to Read First" list and actually follow every reference it
   gives you — including reading the **previous sprint's Handoff Notes** section
   (typically at the bottom of `.claude/sprints/Sprint-<NN-1>.md`).
3. **Open `.claude/specs/Spec-<NN>.md` for the same sprint number and read it in full.**
   `Sprint-<NN>.md` tells you WHAT to do and WHY; `Spec-<NN>.md` is the binding CONTRACT —
   exact field names, JSON request/response shapes, status codes, error codes, locked
   business rules, and Given/When/Then acceptance scenarios you must satisfy. Treat
   anything in the spec marked "locked" as non-negotiable without asking Krishna first;
   anything under "Open Implementation Choices" is normal engineering judgment, to be
   recorded honestly in Handoff Notes.
4. If the requested sprint number doesn't exist (e.g. asked for Sprint 11, or Sprint 0),
   stop and tell Krishna the valid range is 1-10, and ask what they actually meant.
5. If the previous sprint's Handoff Notes section is **missing, still has unfilled
   template placeholders, or says the sprint was left incomplete**, stop here and report
   this to Krishna before going further — proceeding without that information risks
   building on an inconsistent foundation. Ask Krishna how to proceed (e.g. "should I
   inspect the actual code to reconstruct what was done, or did you do this sprint
   outside Claude Code and can fill in the notes now?").
6. If `Sprint-<NN>.md` and `Spec-<NN>.md` ever conflict with each other (e.g. a field name
   or status code differs), **stop and ask Krishna which one is authoritative** rather
   than silently picking one — this should be rare since they were written to agree, but
   don't assume.

## Step 3 — Verify Reality Against Documentation

The docs describe the *intended* state. Before trusting them, check the *actual* state:

1. Run `git log --oneline -20` to see recent history.
2. List the relevant folders for this sprint (e.g. `backend/modules/<relevant_module>/`,
   `frontend/app/dashboard/<relevant_page>/`) and check what already exists.
3. If this sprint's dependencies (per `Implementation-Plan.md`'s dependency graph) are
   supposed to already be built, spot-check that they actually are (e.g. does
   `core/deps.py`'s `get_current_user` actually exist before you write a sprint that
   imports it?).
4. If you find a mismatch between what the docs claim and what the code actually shows —
   **stop and report the discrepancy to Krishna**. Do not silently proceed on
   assumptions about which source is correct.

## Step 4 — Check Manual Setup Prerequisites

Check whether this sprint's doc lists any "Manual-Setup.md" prerequisites (e.g. Gmail
App Password before Sprint 2, Google Vision API key before Sprint 4, EC2+Vercel before
Sprint 10). If the sprint doc says to STOP and confirm a prerequisite is ready, actually
do that — ask Krishna directly: "Before I start, can you confirm you have [X] ready, per
Manual-Setup.md §[N]?" Do not proceed past this point until confirmed.

## Step 5 — Build Your Implementation Understanding

Based on everything read so far, mentally draft:
- The list of files you expect to create or modify
- The order you'll build them in (e.g. models → schemas → service → router → tests)
- Any place where the sprint doc gives you a choice and asks you to "document your
  choice" (these sprint docs intentionally leave some decisions to be made — find them)
- Any place where the sprint doc's instructions seem to conflict with something in
  `TRD.md`, `App-Flow.md`, or the previous sprint's actual implementation

## Step 6 — Summarize and Ask Questions (MANDATORY GATE)

Before writing or editing any file, present to Krishna:

1. **A short summary** of what you understand this sprint to require (2-5 sentences).
2. **The list of files you plan to touch.**
3. **Any open questions** — this is the critical part. Include a question for *anything*
   that isn't fully pinned down by the docs, such as:
   - Ambiguous business logic (e.g. rounding rules, edge cases not explicitly covered)
   - Implementation choices the sprint doc explicitly defers to "your call, document in
     Handoff Notes" — confirm Krishna doesn't have a preference before you pick one
   - Anything where the previous sprint's Handoff Notes contradicts the original sprint
     doc or TRD.md
   - Any place you genuinely don't know what Krishna wants and would otherwise have to
     guess

   If you truly have zero open questions (rare — most sprints have at least a couple of
   "your call" decisions baked in), explicitly say "No open questions — the sprint doc
   and prior context fully specify this work" rather than skipping the question section
   silently. Krishna should always see that this gate was actively considered, not
   skipped.

4. **Stop and wait for Krishna's response.** Do not begin writing code in the same turn
   you ask these questions, even for the parts that seem unambiguous — wait for
   confirmation on everything, since Krishna may also want to adjust scope.

## Step 7 — Implement (Only After Confirmation)

Once Krishna has answered your questions (or explicitly told you to proceed):

1. Work through the sprint doc's task list in order.
2. Follow the verification steps (curl commands, manual checks) given in the sprint doc
   as you go — don't defer all verification to the end.
3. Treat every "locked" contract in `Spec-<NN>.md` (§1 of that doc) as a hard requirement
   — exact field names, status codes, error codes, and numeric thresholds must match
   verbatim, not "close enough."
4. Before considering any individual feature done, walk through `Spec-<NN>.md`'s §2
   acceptance scenarios relevant to it and verify your implementation actually satisfies
   each Given/When/Then — don't just eyeball the happy path.
5. If you hit a NEW ambiguity mid-implementation that wasn't covered by your Step 6
   questions, stop and ask then too — the gate in Step 6 doesn't waive this rule for the
   rest of the session, per `CLAUDE.md` Section 1.
6. Work through the sprint's "Definition of Done" checklist explicitly at the end —
   report which items are checked off and which aren't, honestly.

## Step 8 — Prompt for Handoff

At the end of the session, remind Krishna to run `/handoff` to properly close out this
sprint's Handoff Notes before starting the next session — don't write the Handoff Notes
yourself as a casual afterthought in this command; `/handoff` does that properly with its
own verification pass.
