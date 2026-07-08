// FinTrack Users API functions

import { apiFetch } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  name: string;
  avatar_url: string | null;
}

export interface UpdateProfileInput {
  name?: string;
  username?: string;
  avatar_url?: string;
}

export async function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/users/me");
}

export async function updateProfile(data: UpdateProfileInput): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/users/me", {
    method: "PUT",
    body: data,
  });
}
