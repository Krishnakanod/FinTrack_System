// FinTrack Notification API functions
// Per Spec-08 §1.6: exact function signatures matching backend contracts.

import { apiFetch } from "./client";

// ===== Types =====

export type NotificationType =
  | "group_transaction"
  | "budget_alert"
  | "income_received"
  | "expense_added";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string; // ISO datetime
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface MarkAllAsReadResponse {
  updated_count: number;
}

// ===== API Functions =====

export async function listNotifications(
  isRead?: boolean | null,
  limit: number = 10,
  offset: number = 0,
): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (isRead !== undefined && isRead !== null) params.set("is_read", String(isRead));
  params.set("limit", String(Math.min(limit, 100))); // cap at 100 per backend
  params.set("offset", String(offset));

  const query = params.toString();
  const path = query
    ? `/api/v1/notifications/?${query}`
    : "/api/v1/notifications/";

  return apiFetch<NotificationListResponse>(path);
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<Notification> {
  return apiFetch<Notification>(`/api/v1/notifications/${notificationId}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead(): Promise<MarkAllAsReadResponse> {
  return apiFetch<MarkAllAsReadResponse>("/api/v1/notifications/read-all", {
    method: "PUT",
  });
}