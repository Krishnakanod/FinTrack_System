// FinTrack Groups & Transactions API functions
// Locked contracts per Spec-07 §1.6

import { apiFetch } from "./client";

// ===== Member / User types =====

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

// ===== Group types =====

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  members: MemberProfile[];
  created_at: string;
}

export interface GroupListResponse {
  items: Group[];
}

export interface GroupCreateInput {
  name: string;
  description?: string;
  member_ids: string[];
}

export interface GroupUpdateInput {
  name?: string;
  description?: string;
}

// ===== Transaction / Split types =====

export type SplitType = "equal" | "custom";

export interface SplitEntry {
  user_id: string;
  amount_owed: number;
  is_settled: boolean;
}

export interface GroupTransaction {
  id: string;
  group_id: string;
  description: string;
  total_amount: number;
  paid_by: string;
  split_type: SplitType;
  splits: SplitEntry[];
  date: string;
  created_by: string;
  created_at: string;
}

export interface GroupTransactionListResponse {
  items: GroupTransaction[];
}

export interface CustomSplitInput {
  user_id: string;
  amount_owed: number;
}

export interface GroupTransactionCreateInput {
  amount: number;
  description: string;
  paid_by: string;
  split_type: SplitType;
  split_among?: string[]; // for equal
  splits?: CustomSplitInput[]; // for custom
  date: string; // YYYY-MM-DD
}

// ===== API Functions =====

export async function createGroup(data: GroupCreateInput): Promise<Group> {
  return apiFetch<Group>("/api/v1/groups/groups", {
    method: "POST",
    body: data,
  });
}

export async function listGroups(): Promise<GroupListResponse> {
  return apiFetch<GroupListResponse>("/api/v1/groups/groups");
}

export async function getGroup(id: string): Promise<Group> {
  return apiFetch<Group>(`/api/v1/groups/groups/${id}`);
}

export async function updateGroup(
  id: string,
  data: GroupUpdateInput,
): Promise<Group> {
  return apiFetch<Group>(`/api/v1/groups/groups/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function addMember(groupId: string, userId: string): Promise<Group> {
  return apiFetch<Group>(`/api/v1/groups/groups/${groupId}/members`, {
    method: "POST",
    body: { user_id: userId },
  });
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await apiFetch<void>(`/api/v1/groups/groups/${groupId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function addTransaction(
  groupId: string,
  data: GroupTransactionCreateInput,
): Promise<GroupTransaction> {
  return apiFetch<GroupTransaction>(
    `/api/v1/groups/groups/${groupId}/transactions`,
    {
      method: "POST",
      body: data,
    },
  );
}

export async function listGroupTransactions(
  groupId: string,
): Promise<GroupTransactionListResponse> {
  return apiFetch<GroupTransactionListResponse>(
    `/api/v1/groups/groups/${groupId}/transactions`,
  );
}
