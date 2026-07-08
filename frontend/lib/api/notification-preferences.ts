import { apiFetch } from "./client";

export interface NotificationPreferences {
  friends: boolean;
  groups: boolean;
  budget: boolean;
}

export type UpdateNotificationPreferencesRequest = Partial<NotificationPreferences>;

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>("/api/v1/users/me/notification-preferences");
}

export async function updateNotificationPreferences(
  data: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>("/api/v1/users/me/notification-preferences", {
    method: "PUT",
    body: data,
  });
}
