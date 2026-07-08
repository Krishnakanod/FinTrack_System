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

export interface BudgetAlertPayload {
  budget_id: string;
  category: string;
  period: string;
  threshold: "80" | "100";
  current_spend: number;
  budget_amount: number;
}

export interface NotificationPayload {
  id: string;
  type: "group_transaction" | "budget_alert" | "income_received" | "expense_added";
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FriendEventPayload {
  action:
    | "request_sent"
    | "request_accepted"
    | "request_rejected"
    | "request_cancelled"
    | "friend_removed";
  actor_id: string;
  target_id: string;
}

export interface GroupEventPayload {
  action: "member_exited" | "member_added" | "group_deleted";
  group_id: string;
  actor_id: string;
}

export interface WebSocketEvent {
  type: "GROUP_TRANSACTION" | "BUDGET_ALERT" | "NOTIFICATION" | "FRIEND_EVENT" | "GROUP_EVENT";
  payload: GroupTransactionPayload | BudgetAlertPayload | NotificationPayload | FriendEventPayload | GroupEventPayload | Record<string, unknown>;
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