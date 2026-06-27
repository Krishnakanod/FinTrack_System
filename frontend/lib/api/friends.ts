// FinTrack Friends API functions
// Locked contracts per Spec-06 §1.2

import { apiFetch } from "./client";

// ===== Types =====

export interface FriendProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface FriendsListResponse {
  items: FriendProfile[];
}

// ===== API Functions =====

export async function searchUserByEmail(
  email: string,
): Promise<FriendProfile | null> {
  return apiFetch<FriendProfile | null>(
    `/api/v1/users/search?email=${encodeURIComponent(email)}`,
  );
}

export async function addFriend(friendUserId: string): Promise<FriendProfile> {
  return apiFetch<FriendProfile>("/api/v1/users/friends", {
    method: "POST",
    body: { friend_user_id: friendUserId },
  });
}

export async function listFriends(): Promise<FriendsListResponse> {
  return apiFetch<FriendsListResponse>("/api/v1/users/friends");
}

export async function removeFriend(friendId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/users/friends/${friendId}`, {
    method: "DELETE",
  });
}