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

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  sender_email: string;
  status: string;
  created_at: string;
}

export interface FriendRequestsListResponse {
  items: FriendRequest[];
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

export async function listFriendRequests(
  type: "incoming" | "outgoing",
): Promise<FriendRequestsListResponse> {
  return apiFetch<FriendRequestsListResponse>(
    `/api/v1/users/friends/requests?type=${type}`,
  );
}

export async function acceptFriendRequest(requestId: string): Promise<FriendProfile> {
  return apiFetch<FriendProfile>(`/api/v1/users/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/users/friends/requests/${requestId}/reject`, {
    method: "POST",
  });
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/users/friends/requests/${requestId}/cancel`, {
    method: "POST",
  });
}
