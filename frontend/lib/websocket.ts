// WebSocket hook placeholder
// TODO: implement in Sprint 6, see TRD.md §7 and §12
//
// Connection URL format:
//   wss://<ec2-domain>/ws/{user_id}?token=<access_token>
//
// Events received:
//   { type: "GROUP_TRANSACTION", payload: {...} }
//   { type: "BUDGET_ALERT",      payload: {...} }
//   { type: "NOTIFICATION",      payload: {...} }
//
// This file will export a useWebSocket hook that:
//   - Opens a connection on dashboard layout mount
//   - Reconnects on access token refresh
//   - Dispatches events to the Zustand websocket store
//   - Sends heartbeat ping every 30s

export {};
