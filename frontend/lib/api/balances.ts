// FinTrack Balances API functions
// Locked contracts per Spec-07 §1.6

import { apiFetch } from "./client";
import type { GroupTransactionListResponse } from "./groups";

export type BalanceDirection = "you_owe" | "owed_to_you" | "settled";

export interface Balance {
  counterpart_id: string;
  counterpart_name: string;
  counterpart_upi_id: string | null;
  net_amount: number;
  direction: BalanceDirection;
}

export interface BalanceListResponse {
  items: Balance[];
}

export async function getBalances(): Promise<BalanceListResponse> {
  return apiFetch<BalanceListResponse>("/api/v1/balances");
}

export async function getBalanceWithFriend(
  friendId: string,
): Promise<Balance> {
  return apiFetch<Balance>(`/api/v1/balances/${friendId}`);
}

export async function listBalanceTransactions(
  friendId: string,
): Promise<GroupTransactionListResponse> {
  return apiFetch<GroupTransactionListResponse>(`/api/v1/balances/${friendId}/transactions`);
}
