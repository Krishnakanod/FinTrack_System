// Zustand WebSocket event store
// Locked contract per Spec-06 §1.8
//
// Components can watch `lastEvent` and filter by `type` to react
// to specific events. Sprint 7 (Groups) and Sprint 8 (Budget/Notifications)
// consume this store.
//
// Decision: use a simple `lastEvent` pattern rather than a pub/sub emitter.
// Each component subscribes to the store and filters by event type.
// This keeps the store minimal and avoids the complexity of managing
// dynamic subscriber lists.

"use client";

import { create } from "zustand";

export interface GroupTransactionPayload {
  group_id: string;
  transaction_id: string;
  description: string;
  amount: number;
  actor_name: string;
}

export interface WebSocketEvent {
  type: "GROUP_TRANSACTION" | "BUDGET_ALERT" | "NOTIFICATION";
  payload: GroupTransactionPayload | Record<string, unknown>;
}

interface WebSocketState {
  lastEvent: WebSocketEvent | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  setLastEvent: (event: WebSocketEvent) => void;
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
}

export const useWebSocketStore = create<WebSocketState>()((set) => ({
  lastEvent: null,
  connectionStatus: "disconnected",
  setLastEvent: (event) => set({ lastEvent: event }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));