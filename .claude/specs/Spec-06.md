# Spec-06 — Users/Friends Module + WebSocket Infrastructure (Backend)

**Companion sprint doc:** `.claude/sprints/Sprint-06.md`
**Prerequisite reading:** `.claude/sprints/Sprint-02.md` Handoff Notes (`get_current_user`), `.claude/sprints/Sprint-03.md` Handoff Notes (where `lib/websocket.ts` placeholder and the auth store live), `.claude/sprints/Sprint-05.md` Handoff Notes (exact location of the "From Friend" stub to fix).

---

## 1. Locked Contracts

### 1.1 `friendships` Collection — Beanie Document
```python
class Friendship(Document):
    requester_id: str    # indexed
    addressee_id: str    # indexed
    status: Literal["pending", "accepted"]   # v1 always writes "accepted" directly (no approval flow)
    created_at: datetime

    class Settings:
        name = "friendships"
        # unique compound index: { requester_id: 1, addressee_id: 1 }
```
**Locked behavior:** v1 has no approval step. `add_friend` immediately creates the document with `status="accepted"`. The `status` field exists in the schema for future-proofing but its value is always `"accepted"` when written by this sprint's code — do not build pending-request UI/logic, that's out of scope.

**Bidirectionality (locked):** a friendship between A and B must be queryable from EITHER side without requiring two documents. When listing "my friends," the query must check both `requester_id == my_id` and `addressee_id == my_id`, and return the OTHER party in each case.

### 1.2 Request/Response Schemas — Exact Shapes

**`GET /api/v1/users/me`**
Response — `200 OK`:
```json
{ "id": "string", "email": "string", "name": "string", "avatar_url": null }
```

**`PUT /api/v1/users/me`**
Request (any subset):
```json
{ "name": "string", "avatar_url": "string | null" }
```
Response — `200 OK`: same shape as GET /me.
> Note: `email` is NOT editable via this endpoint (no email-change flow in v1 scope).

**`GET /api/v1/users/search?email=`**
Response — `200 OK` (found):
```json
{ "id": "string", "email": "string", "name": "string", "avatar_url": null }
```
Response — `200 OK` (not found):
```json
null
```
> Locked: return `200` with a `null` body for "not found," NOT a `404` — this is a search result, not a resource fetch; a "no result" is a valid successful search outcome. Frontend (per `App-Flow.md` §7) distinguishes "found → show Add button" vs "null → show no-user message."

**`POST /api/v1/users/friends`**
Request:
```json
{ "friend_user_id": "string" }
```
Response — `201 Created`:
```json
{ "id": "string", "name": "string", "email": "string", "avatar_url": null }
```
(Returns the FRIEND's public info, not the friendship document itself.)
Response — `400 Bad Request` (self-add):
```json
{ "error": "CANNOT_ADD_SELF", "message": "You cannot add yourself as a friend.", "details": {} }
```
Response — `409 Conflict` (already friends):
```json
{ "error": "ALREADY_FRIENDS", "message": "You are already friends with this user.", "details": {} }
```
Response — `404 Not Found` (friend_user_id doesn't exist):
```json
{ "error": "NOT_FOUND", "message": "User not found.", "details": {} }
```

**`GET /api/v1/users/friends`**
Response — `200 OK`:
```json
{ "items": [ { "id": "string", "name": "string", "email": "string", "avatar_url": null } ] }
```
Sort order: alphabetical by `name` (locked, since this populates dropdowns where predictable order matters for usability).

**`DELETE /api/v1/users/friends/{friend_id}`**
Response — `204 No Content`. Deletes the `Friendship` document regardless of which side is `requester_id` vs `addressee_id`.

### 1.3 WebSocket Endpoint Contract

**`WS /ws/{user_id}?token=<access_token>`**
- On connect: server decodes `token` via `core/security.py`'s `decode_token` (must be `type: "access"`, per Spec-02 §1.5). If the decoded `sub` does NOT match the path's `{user_id}`, **reject the connection** (close with code `4001`, locked custom close code meaning "user_id mismatch") — do not silently accept and just ignore the mismatch.
- If the token is invalid/expired entirely, close with code `4000` (locked custom close code meaning "invalid token").
- On successful connect: `await connection_manager.connect(user_id, websocket)`.
- On disconnect (client closes, network drop): `connection_manager.disconnect(user_id)` must run (use `try/finally` or `WebSocketDisconnect` exception handling — do not leak stale connections in the manager's dict).
- Server does not require the client to send any particular message format to stay connected, beyond whatever ping/pong mechanism the frontend implements (Sprint 6 frontend task) — the server should simply tolerate receiving text frames without crashing (a basic `await websocket.receive_text()` loop swallowing pings is sufficient).

### 1.4 WebSocket Event Envelope (Locked Shape — All Future Broadcasts Use This)
```json
{ "type": "GROUP_TRANSACTION" | "BUDGET_ALERT" | "NOTIFICATION", "payload": { ... } }
```
The `type` field's three literal values above are locked exactly as spelled (all-caps, underscore-separated) — Sprint 7 and Sprint 8 broadcast using these exact strings, and Sprint 6/later frontend work switches on these exact strings.

### 1.5 `connection_manager` Contract (Locked Import Path and Method Signatures)
```python
# modules/websocket/manager.py
class ConnectionManager:
    async def connect(self, user_id: str, ws: WebSocket) -> None: ...
    def disconnect(self, user_id: str) -> None: ...
    async def broadcast(self, user_ids: list[str], event: dict) -> None: ...

connection_manager = ConnectionManager()
```
Import path locked: `from modules.websocket.manager import connection_manager`. Sprint 7 and Sprint 8 import this exact singleton.

### 1.6 `create_notification` Contract (Locked Signature)
```python
# modules/notifications/service.py
async def create_notification(
    user_id: str,
    type: str,          # one of: "group_transaction" | "budget_alert" | "income_received" | "expense_added"
    title: str,
    body: str,
    metadata: dict | None = None
) -> Notification:
    """
    Saves to `notifications` collection AND calls connection_manager.broadcast(
        user_ids=[user_id],
        event={"type": "NOTIFICATION", "payload": <serialized notification>}
    ) in the same call. This is the ONLY function other modules should call —
    they must never call connection_manager.broadcast() directly for notification-
    worthy events; only create_notification() does both jobs atomically.
    """
```
Import path locked: `from modules.notifications.service import create_notification`. Both the function name and this exact docstring-described behavior are binding — Sprint 7's groups module and Sprint 8's budget scheduler both call this and only this.

### 1.7 `notifications` Collection — Minimum Viable Schema (This Sprint)
```python
class Notification(Document):
    user_id: str             # indexed
    type: str
    title: str
    body: str
    is_read: bool = False
    metadata: dict = {}
    created_at: datetime     # indexed

    class Settings:
        name = "notifications"
```
Router/list/mark-read endpoints are explicitly NOT built this sprint (Sprint 8's job) — but the model must be complete and stable now since Sprint 7 will be inserting into it.

### 1.8 Frontend WebSocket Store Contract (`lib/store/websocket-store.ts`)
```typescript
interface WebSocketEvent {
  type: 'GROUP_TRANSACTION' | 'BUDGET_ALERT' | 'NOTIFICATION';
  payload: unknown;
}
interface WebSocketState {
  lastEvent: WebSocketEvent | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  // Mechanism for components to subscribe to specific event types is your
  // implementation choice (e.g. a pub/sub emitter, or components watching
  // lastEvent + filtering by type) — document which pattern in Handoff Notes,
  // since Sprint 7 and Sprint 8 frontends need to consume this.
}
```

### 1.9 `lib/websocket.ts` Connection Contract
- Connects to `${NEXT_PUBLIC_WS_URL}/ws/${userId}?token=${accessToken}` when `isAuthenticated` becomes true.
- Reconnects with a fresh token whenever the auth store's `accessToken` changes (e.g. after a silent refresh) — close the old socket, open a new one.
- Sends a heartbeat/ping frame every 30 seconds (any payload acceptable, e.g. the string `"ping"`) to keep the connection alive through proxies (relevant for Sprint 10's Nginx config).
- On close code `4000` or `4001` (per §1.3), does NOT blindly auto-reconnect with the same stale token — should trigger a fresh token acquisition first (via the API client's refresh logic) before reconnecting, to avoid an infinite reconnect-reject loop.

---

## 2. Acceptance Scenarios

### Scenario 6.1 — Add friend by email search
```gherkin
Given User A and User B both have verified accounts
When User A searches GET /api/v1/users/search?email=<UserB's email>
Then User A receives User B's public profile (not null)
When User A POSTs /api/v1/users/friends with friend_user_id=UserB's id
Then User A receives 201
And GET /api/v1/users/friends for User A includes User B
And GET /api/v1/users/friends for User B ALSO includes User A (bidirectional, single document)
```

### Scenario 6.2 — Cannot add self
```gherkin
When User A POSTs /api/v1/users/friends with friend_user_id=their own id
Then they receive 400 with error="CANNOT_ADD_SELF"
```

### Scenario 6.3 — Cannot add the same friend twice
```gherkin
Given User A and User B are already friends
When User A POSTs /api/v1/users/friends with friend_user_id=UserB's id again
Then User A receives 409 with error="ALREADY_FRIENDS"
```

### Scenario 6.4 — Search for non-existent email returns null, not 404
```gherkin
When I GET /api/v1/users/search?email=doesnotexist@nowhere.com
Then I receive 200 with body `null`
```

### Scenario 6.5 — WebSocket connects with valid token
```gherkin
Given a valid access token for user X
When I open a WebSocket to /ws/X?token=<valid token for X>
Then the connection is accepted
And connection_manager.active contains an entry for user X
```

### Scenario 6.6 — WebSocket rejects mismatched user_id
```gherkin
Given a valid access token for user X
When I open a WebSocket to /ws/Y?token=<valid token for X>  (Y != X)
Then the connection is closed with code 4001
```

### Scenario 6.7 — WebSocket rejects invalid token
```gherkin
When I open a WebSocket to /ws/X?token=garbage-not-a-jwt
Then the connection is closed with code 4000
```

### Scenario 6.8 — Broadcast delivers to connected client only
```gherkin
Given user X is connected via WebSocket
And user Y is NOT connected
When connection_manager.broadcast(user_ids=["X", "Y"], event={...}) is called
Then user X's socket receives the event
And no error occurs for user Y despite not being connected (silently skipped)
```

### Scenario 6.9 — create_notification does both jobs atomically
```gherkin
Given user X is connected via WebSocket
When create_notification(user_id="X", type="budget_alert", title="...", body="...") is called
Then a Notification document is saved to MongoDB with is_read=false
And user X's WebSocket receives { "type": "NOTIFICATION", "payload": {...} } within the same call
```

### Scenario 6.10 — Frontend auto-connects on dashboard load
```gherkin
Given I log in successfully
When the dashboard layout mounts
Then a WebSocket connection is initiated automatically (verifiable via browser DevTools Network tab, WS frames)
```

### Scenario 6.11 — Income "From Friend" dropdown now uses real data
```gherkin
Given I have at least one friend added
When I go to /dashboard/income and select Source Type = "From Friend"
Then the friend dropdown is populated from GET /api/v1/users/friends (not the Sprint 5 stub)
And selecting a friend and submitting creates a valid income record with the correct friend_id
```

---

## 3. Explicitly Out of Scope for This Sprint
- Notification list/mark-read endpoints and bell UI (Sprint 8)
- Friend request approval flow (not in v1 scope at all, per `App-Flow.md` §7)
- Redis or any multi-instance WebSocket scaling (explicitly out of scope per `TRD.md` §7.2 scale note)

---

## 4. Open Implementation Choices (Document in Handoff Notes)
- Exact pub/sub mechanism inside `websocket-store.ts` for components to subscribe to specific event types
- Heartbeat/ping payload format and exact interval if you deviate from 30s
- Reconnect backoff strategy (immediate vs. exponential)

---

*End of Spec-06.md*
