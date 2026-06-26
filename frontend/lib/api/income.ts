// FinTrack Income API functions
// Per Spec-05 §1.2: exact function signatures matching backend contracts.

import { apiFetch } from "./client";

// ===== Types =====

export type IncomeSourceType = "salary" | "from_friend";

export type PaymentType = "Cash" | "UPI" | "Card" | "Net Banking";

export interface Income {
  id: string;
  source_type: IncomeSourceType;
  friend_id: string | null;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_type: PaymentType;
  created_at: string; // ISO datetime
}

export interface IncomeCreateInput {
  source_type: IncomeSourceType;
  friend_id?: string | null;
  description?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_type: PaymentType;
}

export interface IncomeUpdateInput {
  source_type?: IncomeSourceType;
  friend_id?: string | null;
  description?: string;
  amount?: number;
  date?: string;
  payment_type?: PaymentType;
}

export interface IncomeFilters {
  source_type?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
}

export interface IncomeListResponse {
  items: Income[];
  total: number;
}

// ===== Enum arrays for UI dropdowns =====

export const INCOME_SOURCE_TYPES: { value: IncomeSourceType; label: string }[] =
  [
    { value: "salary", label: "Salary" },
    { value: "from_friend", label: "From Friend" },
  ];

export const PAYMENT_TYPES: PaymentType[] = [
  "Cash",
  "UPI",
  "Card",
  "Net Banking",
];

// ===== API Functions =====

export async function createIncome(
  data: IncomeCreateInput,
): Promise<Income> {
  return apiFetch<Income>("/api/v1/income/", {
    method: "POST",
    body: data,
  });
}

export async function listIncome(
  filters?: IncomeFilters,
): Promise<IncomeListResponse> {
  const params = new URLSearchParams();
  if (filters?.source_type) params.set("source_type", filters.source_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);

  const query = params.toString();
  const path = query
    ? `/api/v1/income/?${query}`
    : "/api/v1/income/";

  return apiFetch<IncomeListResponse>(path);
}

export async function getIncome(id: string): Promise<Income> {
  return apiFetch<Income>(`/api/v1/income/${id}`);
}

export async function updateIncome(
  id: string,
  data: IncomeUpdateInput,
): Promise<Income> {
  return apiFetch<Income>(`/api/v1/income/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteIncome(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/income/${id}`, {
    method: "DELETE",
  });
}
