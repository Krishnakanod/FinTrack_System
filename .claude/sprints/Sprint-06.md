# Sprint 6 — Users/Friends Module + WebSocket Infrastructure (Backend)

**Layer:** Backend (+ small frontend WebSocket hook wiring)
**Depends on:** Sprint 2 (auth)
**Estimated files touched:** ~12-14

---

## Context to Read First

1. `docs/PRD.md` — Section 3.4 (Friends user stories US-07, US-08 — note: group creation US-08 is Sprint 7's concern, but read for context)
2. `docs/TRD.md` — Section 5.4 (friendships schema), Section 6.3 (Users API), Section 7 (Real-Time Architecture — read fully, this is the core of this sprint), Section 9.1 (in-app notifications — notifications module skeleton only this sprint, full build in Sprint 8)
3. `docs/App-Flow.md` — Section 7 (Add Friend flow), Section 12 (WebSocket Connection Lifecycle — read fully)
4. **Read `.claude/sprints/Sprint-02.md` → Handoff Notes** for `get_current_user` import path.
5. **Read `.claude/sprints/Sprint-03.md` → Handoff Notes** for where the `lib/websocket.ts` placeholder lives on the frontend.

---

## Goal

Build `modules/users/` (profile + friends), `modules/websocket/` (the real-time infrastructure used by Groups and Budgets in later sprints), and a minimal `modules/notifications/` skeleton (just enough to compile — full CRUD/UI comes in Sprint 8). Wire the frontend WebSocket hook into the dashboard layout so a connection opens on login.

---

## Tasks

### 1. Users Module (Profile + Friends)

**Models** (`modules/users/models.py`) — Beanie `Friendship` document per `TRD.md` §5.4. (Note: `User` model already exists from Sprint 2 in `modules/auth/models.py` — import it, don't redefine. Profile fields like `name`/`avatar_url` already live on that model per `TRD.md` §5.11 note.)

**Schemas** (`modules/users/schemas.py`) — `UserProfileResponse`, `UserSearchResult`, `AddFriendRequest`, `FriendResponse`.

**Service** (`modules/users/service.py`):
- `get_profile(user_id) -> UserProfileResponse`
- `update_profile(user_id, data) -> UserProfileResponse`
- `search_user_by_email(email) -> UserSearchResult | None`
- `add_friend(user_id, friend_user_id) -> FriendResponse` — creates `Friendship` doc with `status="accepted"` (no approval flow in v1, per `App-Flow.md` §7); reject if `friend_user_id == user_id`; reject if already friends.
- `list_friends(user_id) -> list[FriendResponse]`
- `remove_friend(user_id, friend_id) -> None`

**Router** (`modules/users/router.py`) — all 6 endpoints from `TRD.md` §6.3. Register in `main.py`.

### 2. WebSocket Module (the real-time core)

**Connection Manager** (`modules/websocket/manager.py`) — implement exactly per `TRD.md` §7.2:
```python
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}
    async def connect(self, user_id: str, ws: WebSocket): ...
    def disconnect(self, user_id: str): ...
    async def broadcast(self, user_ids: List[str], event: dict): ...

connection_manager = ConnectionManager()
```

**Router** (`modules/websocket/router.py`):
- `WS /ws/{user_id}` per `TRD.md` §6.10 and `App-Flow.md` §12:
  - Read `token` from query params
  - Validate JWT (reuse `core/security.py`'s `decode_token` from Sprint 2)
  - Verify the decoded user_id matches the path's `user_id` (reject connection otherwise — security check)
  - `await connection_manager.connect(user_id, websocket)`
  - Loop: `await websocket.receive_text()` to keep connection open (handle ping/pong if frontend sends heartbeats — see `App-Flow.md` §12)
  - On `WebSocketDisconnect`: `connection_manager.disconnect(user_id)`
- Register this router in `main.py` (note: WebSocket routes register the same way as HTTP routes in FastAPI, via `app.include_router` or `app.websocket()`).

### 3. Notifications Module — Skeleton Only

**Models** (`modules/notifications/models.py`) — Beanie `Notification` document per `TRD.md` §5.11. Register in `core/database.py`.

**Service** (`modules/notifications/service.py`) — implement ONLY the function other modules will call, per `TRD.md` §9.1:
```python
async def create_notification(user_id: str, type: str, title: str, body: str, metadata: dict = None) -> Notification:
    """
    Saves the notification to MongoDB AND broadcasts it via WebSocket
    in the same call, per TRD.md §9.1. This is the ONLY public function
    other modules should call.
    """
    notification = await Notification(...).insert()
    from modules.websocket.manager import connection_manager
    await connection_manager.broadcast(
        user_ids=[user_id],
        event={"type": "NOTIFICATION", "payload": notification.dict()}
    )
    return notification
```
- **Do NOT build the router (list/mark-read endpoints) yet** — that's Sprint 8's job. This sprint only needs `create_notification()` to exist and work, since Sprint 7 (Groups) will call it.
- Add a `# TODO Sprint 8: build modules/notifications/router.py with GET / and PUT /{id}/read endpoints` comment.

### 4. Frontend: Wire Up WebSocket Hook

- Implement `lib/websocket.ts` (currently a placeholder per Sprint 3's Handoff Notes) per `TRD.md` §12 and `App-Flow.md` §12:
  - `useWebSocket()` hook: connects on mount if `isAuthenticated`, using `NEXT_PUBLIC_WS_URL` + user id + access token as query param
  - Listens for messages, dispatches to a Zustand store (`lib/store/websocket-store.ts`) that other components can subscribe to
  - Implements reconnect-with-fresh-token logic when the access token is refreshed (every ~15 min)
  - Sends a ping every 30s to keep the connection alive through Nginx/EC2 timeouts (per `App-Flow.md` §12) — note: this matters for Sprint 10's deployment, but build it now so it's not forgotten
- Wire this hook into `app/dashboard/layout.tsx` (so connection opens whenever any dashboard page is active).
- For this sprint, there's nothing visually different yet (no UI consumes WebSocket events until Sprint 7/8) — verify the connection itself works via browser DevTools Network tab (WS frames) or a simple `console.log` on message receipt.

### 5. Friends Page (Minimal, since full Groups integration is Sprint 7)
- `app/dashboard/friends/page.tsx` — search by email, add friend, list friends, remove friend. Simple list UI, doesn't need to be elaborate since it's mostly a utility page feeding into Groups (Sprint 7) and Income (Sprint 5's stub, now fixable).
- **Go back and fix Sprint 5's "From Friend" income dropdown stub** now that `GET /api/v1/users/friends` exists — wire it to the real endpoint. Check Sprint 5's Handoff Notes for the exact file/line.

### 6. Verification
```bash
TOKEN="<paste access token>"

curl "http://localhost:8000/api/v1/users/search?email=friend@example.com" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:8000/api/v1/users/friends \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"friend_user_id":"<id>"}'

curl http://localhost:8000/api/v1/users/friends -H "Authorization: Bearer $TOKEN"
```
WebSocket: use a simple `wscat` command or browser console:
```js
const ws = new WebSocket(`ws://localhost:8000/ws/<user_id>?token=<access_token>`);
ws.onmessage = (e) => console.log("received:", e.data);
```

---

## Definition of Done

- [ ] Friend search, add, list, remove all work via curl
- [ ] Cannot add yourself as a friend (validated)
- [ ] WebSocket connection succeeds with a valid token and rejects with an invalid/mismatched one
- [ ] `connection_manager.broadcast()` successfully delivers a test message to a connected client (verify manually by writing a temporary test endpoint that calls broadcast, or via a unit test)
- [ ] `notifications.service.create_notification()` saves to MongoDB AND triggers a WebSocket push in one call
- [ ] Frontend `lib/websocket.ts` connects automatically on dashboard load (verify in browser DevTools)
- [ ] Income page's "From Friend" dropdown now uses real friend data (Sprint 5 stub fixed)
- [ ] Friends page lets you search/add/list/remove friends

---

## Handoff Notes

### Sprint 6 Handoff Notes

**What was built:**

Backend:
- `backend/modules/users/models.py` — `Friendship` Beanie document with bidirectional query support
- `backend/modules/users/schemas.py` — `UserProfileResponse`, `UserSearchResult`, `AddFriendRequest`, `FriendResponse`, `FriendsListResponse`
- `backend/modules/users/service.py` — profile CRUD, search-by-email, add/list/remove friends (status always "accepted")
- `backend/modules/users/router.py` — `/api/v1/users/me`, `/search`, `/friends`, `/friends/{friend_id}`
- `backend/modules/websocket/manager.py` — singleton `ConnectionManager` with `connect`, `disconnect`, `broadcast`
- `backend/modules/websocket/router.py` — JWT-authenticated `WS /ws/{user_id}` with 4000/4001 close codes
- `backend/modules/notifications/models.py` — `Notification` Beanie document
- `backend/modules/notifications/service.py` — `create_notification()` that persists to DB and broadcasts via WebSocket

Frontend:
- `frontend/lib/websocket.ts` — `useWebSocket()` hook with reconnect, fresh-token handling, and 30s "ping" heartbeat
- `frontend/lib/store/websocket-store.ts` — Zustand store exposing `lastEvent` and `connectionStatus`
- `frontend/app/dashboard/layout.tsx` — WebSocket hook wired in, auto-connects when authenticated
- `frontend/app/dashboard/friends/page.tsx` — full friends UI: search by email, add, list, remove with confirmation
- `frontend/app/dashboard/income/page.tsx` — "From Friend" source type now populates dropdown from `GET /api/v1/users/friends`

Tests:
- `tests/page-objects.ts` — added `FriendsPage` POM
- `tests/tests/friends.spec.ts` — friends E2E spec

**Decisions made (not already in TRD.md):**

- Friendships stored as a single document; listing checks both `requester_id` and `addressee_id`.
- WebSocket store pattern: components watch `lastEvent` and filter by `type` rather than a pub/sub emitter.
- Heartbeat payload: plain string `"ping"` sent every 30s.
- Reconnect strategy: exponential backoff capped at ~32s; no auto-reconnect on close codes 4000/4001 (stale token).
- `create_notification()` is the only public dispatch point — it persists and broadcasts in one call.

**Known issues / deferred items:**

- `modules/notifications/router.py` (list/mark-read endpoints) deferred to Sprint 8 by design.
- `tests/tests/friends.spec.ts` could not be verified passing in this session due to a local Playwright path/version resolution issue; the auth login test passed and the backend endpoints verified successfully via curl.
- `Notification` model uses `metadata: dict = {}` default (safe under Pydantic v2).

**What Sprint 7 needs to know:**

- Import for broadcasts: `from modules.websocket.manager import connection_manager`
- Import for notifications: `from modules.notifications.service import create_notification`
- Friend list endpoint: `GET /api/v1/users/friends` returns `{ items: [{ id, name, email, avatar_url }] }` sorted alphabetically by `name`.
- WebSocket store: subscribe to `lastEvent`; filter on `type === "GROUP_TRANSACTION"` for real-time group updates.
- Frontend WS URL pattern: `${NEXT_PUBLIC_WS_URL}/ws/${userId}?token=${accessToken}`.

**What Sprint 8 needs to know:**

- `modules/notifications/models.py` `Notification` document shape is final — build `router.py` (`GET /`, `PUT /{id}/read`, `PUT /read-all`) against it.
