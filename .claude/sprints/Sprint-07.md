# Sprint 7 — Groups & Splitting (Backend + Frontend, Core Real-Time Flow)

**Layer:** Both
**Depends on:** Sprint 4 (expense data shape conventions), Sprint 6 (friends, WebSocket, notifications)
**Estimated files touched:** ~22-26 (largest sprint — work backend-first, verify with curl, THEN build frontend in the same session)

---

## Context to Read First

1. `docs/PRD.md` — Section 3.4 (US-08 Create Group), Section 3.5 (US-09 Add Group Transaction, US-10 View Balances) — **this is the most important section of the PRD for this sprint, read carefully**
2. `docs/TRD.md` — Section 5.7-5.9 (groups, group_transactions, balances schemas), Section 6.6 (Groups/Balances API), Section 7.1 (WebSocket Flow for Group Transaction — this is the exact sequence to implement)
3. `docs/App-Flow.md` — Section 8 (the full Create Group → Add Transaction → Real-Time Split flow — **read this entire section twice**, it's the most detailed flow in the docs and this sprint implements it exactly)
4. **Read `.claude/sprints/Sprint-06.md` → Handoff Notes** for `connection_manager` and `create_notification` import paths/signatures, and the frontend websocket-store shape.
5. **Read `.claude/sprints/Sprint-03.md` → Handoff Notes** for dashboard layout patterns.

---

## Goal

Build the complete Groups module: create groups, manage members, add group transactions with equal/custom splitting, automatic balance calculation, and the full real-time notification fan-out to all affected members. Build the matching frontend with live updates via WebSocket. This is the centerpiece feature of the app — budget extra care here.

---

## Tasks — Backend First

### 1. Models (`modules/groups/models.py`)
Beanie documents per `TRD.md` §5.7-5.9: `Group`, `GroupTransaction` (with embedded `splits` list), `Balance`. Register in `core/database.py`.

### 2. Schemas (`modules/groups/schemas.py`)
- `GroupCreate` (name, description, member_ids), `GroupUpdate`, `GroupResponse` (with populated member details, not just IDs)
- `AddMemberRequest`
- `SplitEntry` (user_id, amount_owed)
- `GroupTransactionCreate` (amount, description, paid_by, split_type, splits: list[SplitEntry], date)
  - **Validation:** if `split_type == "equal"`, the backend computes `splits` itself (ignore/recompute client-sent equal splits to avoid float rounding mismatches client-side — divide amount by len(split_among), distribute remainder pennies to first N members deterministically). If `split_type == "custom"`, validate `sum(splits.amount_owed) == amount` (within a small epsilon for decimal rounding).
- `GroupTransactionResponse`
- `BalanceResponse` (counterpart_id, counterpart_name, net_amount, direction: "you_owe" | "owed_to_you")

### 3. Service (`modules/groups/service.py`) — the core logic
- `create_group(user_id, data: GroupCreate) -> Group` — creator auto-added to members
- `get_group(user_id, group_id) -> GroupResponse` — 403 if user not a member
- `list_groups(user_id) -> list[GroupResponse]`
- `update_group(user_id, group_id, data) -> GroupResponse`
- `add_member(user_id, group_id, new_member_id) -> GroupResponse`
- `remove_member(user_id, group_id, member_id) -> None`
- `add_transaction(user_id, group_id, data: GroupTransactionCreate) -> GroupTransactionResponse`:

  Implement the **exact sequence from `App-Flow.md` §8.2 and `TRD.md` §7.1**:
  1. Validate split amounts sum correctly (or compute for equal split)
  2. Save `GroupTransaction` document
  3. Update the `balances` collection for every member involved — **decide and document clearly which convention you use**: either (a) write both directions (user→paid_by positive, paid_by→user negative) on every transaction, or (b) store only one direction and compute the inverse on read. Pick ONE and be consistent — this matters a lot for correctness. Recommended: option (a), since `TRD.md` §5.9 describes a directional schema and writing both directions makes `GET /balances` trivially simple (no sign-flipping logic needed at read time).
  4. For every affected member EXCEPT the user who submitted the request: call `notifications.service.create_notification(...)` (imported per Sprint 6's Handoff Notes) with type `"group_transaction"`, which internally also triggers the WebSocket broadcast — **do not call `connection_manager.broadcast()` directly here, let `create_notification()` handle both** (per the consolidated design in `TRD.md` §9.1, this avoids duplicate dispatch logic).
  5. Return the created transaction to the actor (their own UI updates via normal query invalidation, not WebSocket, since they already know what they just did)

- `list_group_transactions(user_id, group_id) -> list[GroupTransactionResponse]`
- `get_balances(user_id) -> list[BalanceResponse]` — aggregate from `balances` collection
- `get_balance_with_friend(user_id, friend_id) -> BalanceResponse`

### 4. Router (`modules/groups/router.py`)
All endpoints from `TRD.md` §6.6. Register in `main.py`.

### 5. Backend Verification (curl) — do this before moving to frontend
```bash
TOKEN="<user A token>"
curl -X POST http://localhost:8000/api/v1/groups/groups \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Trip to Goa","description":"","member_ids":["<userB_id>","<userC_id>"]}'

curl -X POST http://localhost:8000/api/v1/groups/groups/<group_id>/transactions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":900,"description":"Dinner","paid_by":"<userA_id>","split_type":"equal","splits":[],"date":"2026-06-20"}'

curl http://localhost:8000/api/v1/balances -H "Authorization: Bearer $TOKEN"
```
**Critically:** open a second WebSocket connection (per Sprint 6's verification method) as User B in another terminal/browser console BEFORE running the transaction curl as User A, and confirm User B's socket receives the `GROUP_TRANSACTION` event in real time.

---

## Tasks — Frontend (after backend is verified working)

### 6. API Functions (`lib/api/groups.ts`)
`createGroup()`, `listGroups()`, `getGroup()`, `updateGroup()`, `addMember()`, `removeMember()`, `addTransaction()`, `listGroupTransactions()`, `getBalances()`, `getBalanceWithFriend()`.

### 7. Groups List Page (`app/dashboard/groups/page.tsx`)
- List of user's groups (card grid), "Create Group" button → dialog with name, description, member multi-select (from friends list, per Sprint 6).

### 8. Group Detail Page (`app/dashboard/groups/[id]/page.tsx`)
- Member list, transaction history (most recent first), "Add Transaction" button.
- **Add Transaction form** per `App-Flow.md` §8.2:
  - Amount, Description, "Paid By" dropdown (group members), "Split Among" multi-select (defaults to all members)
  - Split Type toggle: Equal (read-only computed amounts shown) / Custom (editable per-person amounts with live sum validation against total — disable submit until sum matches)
- On successful submission, invalidate `['groups', groupId, 'transactions']` and `['balances']` query keys.

### 9. Real-Time Update Wiring
- Subscribe to the websocket-store (per Sprint 6's Handoff Notes) for `GROUP_TRANSACTION` events.
- On receipt: invalidate the same query keys as above (`['groups', groupId, 'transactions']`, `['balances']`) so OTHER members' UIs update without a page refresh.
- Show a toast: `"{actor name} added ₹{amount} — {description}"` per `App-Flow.md` §8.2.

### 10. Balances Page (`app/dashboard/balances/page.tsx`)
- Per `App-Flow.md` §8.3: "You owe ₹X to [Name]" / "[Name] owes you ₹Y" list, filterable by group or friend.

### 11. Playwright Tests (`tests/groups.spec.ts`)
- Create group, add transaction (equal split), verify balances update for the test user.
- **Real-time test:** use two separate Playwright browser contexts (simulating User A and User B logged in simultaneously) — User A adds a transaction, assert User B's page (already open, no refresh) shows the new transaction/toast within a reasonable timeout. This is the most important test in the whole suite — it proves the core feature works.
- Custom split validation: assert the form blocks submission when split amounts don't sum to the total.

---

## Definition of Done

- [ ] Group creation, member management work via curl and UI
- [ ] Equal split correctly divides amount (including penny-rounding edge cases, e.g. ₹100 / 3 people)
- [ ] Custom split validates sum == total, both backend and frontend
- [ ] Balances correctly reflect debts after multiple transactions across multiple groups
- [ ] Real-time: User B sees User A's transaction appear live, without refreshing, via WebSocket
- [ ] Toast notification appears for affected members on new group transactions
- [ ] `tests/groups.spec.ts` passes, including the two-context real-time test
- [ ] Balances page correctly shows "you owe" vs "owed to you" directionality

---

## Handoff Notes (fill this out at the end of the sprint)

```markdown
### Sprint 7 Handoff Notes

**What was built:**
- [fill in]

**Decisions made (not already in TRD.md):**
- Balance storage convention used: [bidirectional write / single direction + computed
  read — confirm which was chosen, this matters for Sprint 9's analytics]
- Penny-rounding remainder distribution logic for equal splits: [describe]

**Known issues / deferred items:**
- [fill in, or "None"]

**What Sprint 8 needs to know:**
- Balances collection write pattern, in case budget alerts ever need to reference
  group spending (they currently only look at personal `expenses`, per PRD scope,
  so this is likely N/A — confirm)

**What Sprint 9 needs to know:**
- Exact group_transactions schema as actually implemented (any deviations from
  TRD.md §5.8), since Analytics/Reports will need to query and include these
  alongside expenses and income
- Balance storage convention (see above) — Reports need to read this correctly
```
