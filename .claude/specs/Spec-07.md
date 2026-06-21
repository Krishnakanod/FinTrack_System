# Spec-07 — Groups & Splitting (Backend + Frontend, Core Real-Time Flow)

**Companion sprint doc:** `.claude/sprints/Sprint-07.md`
**Prerequisite reading:** `.claude/sprints/Sprint-06.md` Handoff Notes / `Spec-06.md` for `connection_manager`/`create_notification` import paths and the frontend websocket-store pattern.

**This is the most important spec in the project — read it fully before writing any code. The balance calculation convention below is locked precisely because an inconsistent convention here silently corrupts financial data in a way that's hard to detect later.**

---

## 1. Locked Contracts

### 1.1 `groups` Collection
```python
class Group(Document):
    name: str
    description: str | None = None
    created_by: str            # user_id
    members: list[str]         # user_ids, creator always included
    created_at: datetime

    class Settings:
        name = "groups"
        # index: { members: 1 }
```

### 1.2 `group_transactions` Collection
```python
class SplitEntry(BaseModel):   # embedded, not a separate Document
    user_id: str
    amount_owed: Decimal
    is_settled: bool = False

class GroupTransaction(Document):
    group_id: str               # indexed
    description: str
    total_amount: Decimal
    paid_by: str                # user_id
    split_type: Literal["equal", "custom"]
    splits: list[SplitEntry]    # does NOT include paid_by themselves
    date: datetime
    created_by: str             # user_id of whoever submitted the request
    created_at: datetime

    class Settings:
        name = "group_transactions"
        # indexes: { group_id: 1, date: -1 }, { "splits.user_id": 1 }
```
**Locked: `splits` excludes the payer.** If `paid_by` is also among the people splitting the bill (e.g. a 3-way dinner where the payer also eats), the payer's own share is implicitly "money they paid to themselves" and is NOT recorded as a debt — only entries for members who actually owe the payer go in `splits`. Example: ₹900 dinner, 3 people (A pays, B and C also ate equally) → `splits = [{user_id: B, amount_owed: 300}, {user_id: C, amount_owed: 300}]`, NOT including A's own ₹300 share as a debt entry.

### 1.3 `balances` Collection — LOCKED Convention (Bidirectional Write)

```python
class Balance(Document):
    user_id: str          # indexed
    counterpart_id: str   # indexed
    net_amount: Decimal   # positive = user_id owes counterpart_id; negative = counterpart_id owes user_id
    updated_at: datetime

    class Settings:
        name = "balances"
        # unique compound index: { user_id: 1, counterpart_id: 1 }
```

**THE CONVENTION (locked, do not deviate):**

For every group transaction, for every entry in `splits` where `split.user_id != paid_by`:

```
upsert Balance{ user_id: split.user_id, counterpart_id: paid_by }:
    $inc net_amount by +split.amount_owed
    (this document means: "split.user_id owes paid_by this much")

upsert Balance{ user_id: paid_by, counterpart_id: split.user_id }:
    $inc net_amount by -split.amount_owed
    (this document means: "paid_by is owed this much by split.user_id,
     expressed as a NEGATIVE number on paid_by's own balance document
     since positive always means 'I owe them' from the document owner's
     perspective")
```

**Both directions are written on every transaction — this is two `Balance` documents updated (or created) per `splits` entry, not one.** This is deliberate: it makes `GET /balances` for any user a single trivial query (`find({user_id: requesting_user_id})`) with no sign-flipping or cross-referencing needed at read time. Do not optimize this away to "only write one direction and compute the inverse on read" — that was considered and rejected for this project (see TRD.md §7.1 / Sprint-07.md Task 2 step 3 for the original discussion); it adds read-time complexity for no benefit at this data scale.

**Interpretation when reading a `Balance` document for `user_id=X, counterpart_id=Y`:**
- `net_amount > 0` → X owes Y that amount
- `net_amount < 0` → Y owes X `abs(net_amount)`
- `net_amount == 0` → settled up; the document may still exist (don't delete on reaching zero, simpler to leave it)

### 1.4 Equal-Split Penny-Rounding Rule (Locked)
```
base_share = floor((total_amount / num_split_among_members) * 100) / 100   # rounded down to paise
remainder = total_amount - (base_share * num_split_among_members)
remainder is the leftover paise (e.g. ₹0.01-0.03 from rounding)

Distribute the remainder by adding 1 paisa each to the FIRST N members
(in the order they appear in the `split_among` array from the request),
where N = round(remainder * 100) — i.e. however many extra paise exist.
```
**Worked example (locked, must match):** ₹100 split equally among 3 people → `base_share = 33.33`, `3 × 33.33 = 99.99`, `remainder = 0.01` → first member in the list gets `33.34`, the other two get `33.33`. Sum = `100.00` exactly.

The backend computes this itself for `split_type: "equal"` — **never trust client-sent equal-split amounts**; recompute server-side using this exact algorithm regardless of what the request body's `splits` array contains for an equal split.

### 1.5 Custom-Split Validation (Locked)
```
sum(splits.amount_owed) must equal total_amount, within epsilon = 0.01 (one paisa,
to tolerate floating point representation, even though Decimal is used — still
validate with a small epsilon rather than exact equality)
```
Violation → `422`:
```json
{ "error": "SPLIT_MISMATCH", "message": "Split amounts must sum to the total amount.", "details": { "expected": 900.00, "received": 895.00 } }
```

### 1.6 Request/Response Schemas — Exact Shapes

**`POST /api/v1/groups/groups`**
Request:
```json
{ "name": "Trip to Goa", "description": "", "member_ids": ["userB_id", "userC_id"] }
```
Response — `201 Created`:
```json
{
  "id": "string",
  "name": "Trip to Goa",
  "description": "",
  "created_by": "userA_id",
  "members": [
    { "id": "userA_id", "name": "...", "email": "...", "avatar_url": null },
    { "id": "userB_id", "name": "...", "email": "...", "avatar_url": null },
    { "id": "userC_id", "name": "...", "email": "...", "avatar_url": null }
  ],
  "created_at": "ISO8601"
}
```
> Locked: the response's `members` field is a list of POPULATED user objects (id, name, email, avatar_url), not bare user_id strings — frontend needs display names without a second round-trip. The creator (`userA_id`) is automatically included even though only `member_ids` for B and C were sent in the request.

**`GET /api/v1/groups/groups`** — `200` with `{ "items": [ <group objects, same shape as above> ] }`.

**`GET /api/v1/groups/groups/{id}`** — `200` with single group object (same shape), or `403` if requesting user is not a member:
```json
{ "error": "NOT_A_MEMBER", "message": "You are not a member of this group.", "details": {} }
```

**`POST /api/v1/groups/groups/{id}/members`**
Request: `{ "user_id": "string" }` — adds a single member.
Response — `200 OK`: updated group object.

**`DELETE /api/v1/groups/groups/{id}/members/{user_id}`** — `204 No Content`.
> Locked edge case: removing a member does NOT retroactively alter past `group_transactions` or `balances` — those remain as historical record. A removed member simply can't be selected in future transactions for that group.

**`POST /api/v1/groups/groups/{id}/transactions`**
Request:
```json
{
  "amount": 900.00,
  "description": "Dinner",
  "paid_by": "userA_id",
  "split_type": "equal",
  "split_among": ["userA_id", "userB_id", "userC_id"],
  "date": "2026-06-20"
}
```
> Note the field is `split_among` (list of user_ids participating in the split) on the REQUEST, distinct from `splits` (list of `{user_id, amount_owed}`) on the STORED document/RESPONSE. For `split_type: "equal"`, the backend computes `splits` from `split_among` per §1.4, **excluding `paid_by` from the stored `splits` array even if `paid_by` is present in `split_among`** (per §1.2). For `split_type: "custom"`, the request must include an explicit `splits` array instead of `split_among`:
```json
{
  "amount": 900.00,
  "description": "Dinner",
  "paid_by": "userA_id",
  "split_type": "custom",
  "splits": [ { "user_id": "userB_id", "amount_owed": 400.00 }, { "user_id": "userC_id", "amount_owed": 500.00 } ],
  "date": "2026-06-20"
}
```
Response — `201 Created`:
```json
{
  "id": "string",
  "group_id": "string",
  "description": "Dinner",
  "total_amount": 900.00,
  "paid_by": "userA_id",
  "split_type": "equal",
  "splits": [ { "user_id": "userB_id", "amount_owed": 300.00, "is_settled": false }, { "user_id": "userC_id", "amount_owed": 300.00, "is_settled": false } ],
  "date": "2026-06-20T00:00:00Z",
  "created_by": "userA_id",
  "created_at": "ISO8601"
}
```

**`GET /api/v1/groups/groups/{id}/transactions`** — `200` with `{ "items": [ <transaction objects> ] }`, sorted `date` descending.

**`GET /api/v1/balances`**
Response — `200 OK`:
```json
{
  "items": [
    { "counterpart_id": "userB_id", "counterpart_name": "...", "net_amount": -300.00, "direction": "owed_to_you" },
    { "counterpart_id": "userC_id", "counterpart_name": "...", "net_amount": 300.00, "direction": "you_owe" }
  ]
}
```
> Locked: `direction` is a derived convenience field — `"you_owe"` when the underlying `Balance.net_amount > 0`, `"owed_to_you"` when `< 0`. `net_amount` in the response is returned as-is from the stored document (i.e., can be negative) — frontend uses `direction` for display logic plus `Math.abs(net_amount)` for the displayed figure. Entries where `net_amount == 0` are EXCLUDED from this response (no point showing settled balances in the summary list).

**`GET /api/v1/balances/{friend_id}`** — `200` with a single object matching one entry's shape above, or `200` with `{ "counterpart_id": friend_id, "counterpart_name": "...", "net_amount": 0, "direction": "settled" }` if no balance document exists yet (never `404` — a zero balance is a valid state, not "not found").

### 1.7 Notification Fan-Out Rule (Locked)
On `POST .../transactions` success, for every `user_id` in `{paid_by} ∪ {split.user_id for split in splits}` EXCEPT the actor who submitted the request (`created_by`), call:
```python
await create_notification(
    user_id=member_id,
    type="group_transaction",
    title=f"New expense in {group.name}",
    body=f"{actor.name} added ₹{amount} — {description}",
    metadata={"group_id": group_id, "transaction_id": transaction_id}
)
```
**Do not call `connection_manager.broadcast()` directly anywhere in `groups/service.py`** — `create_notification()` (Spec-06 §1.6) already handles both DB write and WebSocket push; calling broadcast separately would double-fire the event.

### 1.8 Frontend — Real-Time Invalidation Rule (Locked Query Keys)
On receiving a `GROUP_TRANSACTION` WebSocket event (per Spec-06 §1.4 envelope), the frontend must invalidate exactly these TanStack Query keys:
```typescript
['groups', payload.group_id, 'transactions']
['balances']
```
And show a toast with the format: `"{actor name} added ₹{amount} — {description}"` (exact copy wording beyond this content is your choice).

---

## 2. Acceptance Scenarios

### Scenario 7.1 — Create group, creator auto-included
```gherkin
Given User A is logged in, and Users B and C exist as A's friends
When User A POSTs /api/v1/groups/groups with member_ids=[B, C] (NOT including A)
Then the response's members array contains A, B, and C (3 total)
```

### Scenario 7.2 — Equal split with penny rounding
```gherkin
Given a group of 3 members (A, B, C), A is paid_by
When A POSTs a transaction: amount=100.00, split_type="equal", split_among=[A, B, C]
Then the stored splits array contains exactly 2 entries (B and C, NOT A)
And one of them has amount_owed=33.34 and the other 33.33 (per §1.4's exact algorithm)
And the SUM of all three people's actual shares (A's implicit 33.33 + B's + C's) equals exactly 100.00
```

### Scenario 7.3 — Custom split validation rejects mismatched sum
```gherkin
When A POSTs a transaction: amount=900.00, split_type="custom", splits=[{B, 400}, {C, 500.50}]
Then I receive 422 with error="SPLIT_MISMATCH" (sum is 900.50, not 900.00)
```

### Scenario 7.4 — Custom split validation accepts matching sum
```gherkin
When A POSTs a transaction: amount=900.00, split_type="custom", splits=[{B, 400.00}, {C, 500.00}]
Then I receive 201
```

### Scenario 7.5 — Balance convention — bidirectional write verified
```gherkin
Given a fresh group with no prior transactions between A and B
When A pays ₹300 for a transaction where B's split is 300.00 (A is paid_by, B is in splits)
Then querying Balance{user_id: B, counterpart_id: A} shows net_amount = +300.00
And querying Balance{user_id: A, counterpart_id: B} shows net_amount = -300.00
And GET /api/v1/balances for B shows { counterpart_id: A, net_amount: 300.00, direction: "you_owe" }
And GET /api/v1/balances for A shows { counterpart_id: B, net_amount: -300.00, direction: "owed_to_you" }
```

### Scenario 7.6 — Balances accumulate correctly across multiple transactions
```gherkin
Given A and B have an existing balance where B owes A ₹300 (from Scenario 7.5)
When a SECOND transaction happens where A's split is 100.00 and B is paid_by (roles reversed)
Then Balance{user_id: A, counterpart_id: B}.net_amount becomes +100.00 + (-300.00) = -200.00
  (A previously was owed 300 i.e. -300 on A's own doc; now A owes 100 more, net -200,
   meaning B still owes A a net of ₹200 overall)
And this nets out correctly — i.e. the running balance correctly accumulates via $inc, not overwrite
```

### Scenario 7.7 — Real-time delivery to a second member
```gherkin
Given User A and User B are both connected via WebSocket (two separate browser sessions/contexts)
And both are members of the same group
When User A submits a group transaction
Then User A's own UI updates via normal request/response (their own query invalidation)
And User B's UI — WITHOUT User B refreshing or taking any action — shows:
  - A toast notification with A's name, the amount, and description
  - The new transaction appearing in the group's transaction list
  - The balances page reflecting the new debt
  all within a few seconds of A's submission
```

### Scenario 7.8 — Non-member cannot view group
```gherkin
Given User D is not a member of Group G
When User D GETs /api/v1/groups/groups/{G.id}
Then User D receives 403 with error="NOT_A_MEMBER"
```

### Scenario 7.9 — Removing a member doesn't alter history
```gherkin
Given Group G has a past transaction involving member C
When C is removed from Group G via DELETE .../members/C
Then the past transaction record still shows C's split exactly as before
And C's balance with other members is unaffected by the removal itself
And C can no longer be selected as a split participant in NEW transactions for G
```

---

## 3. Explicitly Out of Scope for This Sprint
- Settling/marking a debt as paid (the `is_settled` field exists on `SplitEntry` but no endpoint to toggle it is required by PRD v1 scope — leave the field present but unused beyond its `false` default, unless Krishna requests it)
- Automatic debt simplification across multiple group members (explicitly out of PRD scope, §2.4)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Whether group member multi-select UI uses a specific component pattern (checkbox list, tag input, etc.)
- Exact toast styling/duration for real-time group transaction notifications

---

*End of Spec-07.md*
