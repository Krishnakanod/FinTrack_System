// FinTrack Budget API functions
// Per Spec-08 §1.6: exact function signatures matching backend contracts.

import { apiFetch } from "./client";

// ===== Types =====

export type ExpenseCategory =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Entertainment"
  | "Health"
  | "Utilities"
  | "Other";

export type BudgetPeriod = "daily" | "monthly" | "quarterly" | "yearly";

export interface Budget {
  id: string;
  category: ExpenseCategory;
  period: BudgetPeriod;
  amount: number;
  alert_sent_80: boolean;
  alert_sent_100: boolean;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface BudgetStatus extends Budget {
  current_spend: number;
  percentage_used: number;
}

export interface BudgetCreateInput {
  category: ExpenseCategory;
  period: BudgetPeriod;
  amount: number;
}

export interface BudgetUpdateInput {
  amount: number;
}

export interface BudgetListResponse {
  items: Budget[];
}

export interface BudgetStatusListResponse {
  items: BudgetStatus[];
}

// ===== API Functions =====

export async function createBudget(
  data: BudgetCreateInput,
): Promise<Budget> {
  return apiFetch<Budget>("/api/v1/budgets/", {
    method: "POST",
    body: data,
  });
}

export async function listBudgets(): Promise<BudgetListResponse> {
  return apiFetch<BudgetListResponse>("/api/v1/budgets/");
}

export async function updateBudget(
  id: string,
  data: BudgetUpdateInput,
): Promise<Budget> {
  return apiFetch<Budget>(`/api/v1/budgets/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/budgets/${id}`, {
    method: "DELETE",
  });
}

export async function getBudgetStatus(): Promise<BudgetStatus[]> {
  return apiFetch<BudgetStatus[]>("/api/v1/budgets/status");
}

// ===== Enum arrays for UI dropdowns =====

export const BUDGET_PERIODS: BudgetPeriod[] = [
  "daily",
  "monthly",
  "quarterly",
  "yearly",
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Other",
];