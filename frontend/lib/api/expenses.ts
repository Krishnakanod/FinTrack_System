// FinTrack Expense API functions
// Per Spec-05 §1.1: exact function signatures matching backend contracts.

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

export type PaymentType = "Cash" | "UPI" | "Card" | "Net Banking";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_type: PaymentType;
  source: "manual" | "ocr";
  ocr_confidence: number | null;
  receipt_image_url: string | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ExpenseCreateInput {
  category: ExpenseCategory;
  description?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_type: PaymentType;
}

export interface ExpenseUpdateInput {
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  date?: string;
  payment_type?: PaymentType;
}

export interface OcrUploadData {
  image_base64: string;
  mime_type: string;
}

export interface OcrResult {
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  merchant: string | null;
  raw_text: string;
  confidence_score: number;
}

export interface OcrConfirmInput {
  category: ExpenseCategory;
  description?: string;
  amount: number;
  date: string;
  payment_type: PaymentType;
  ocr_confidence: number;
}

export interface ExpenseFilters {
  category?: string;
  payment_type?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
}

// ===== Enum arrays for UI dropdowns =====

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Other",
];

export const PAYMENT_TYPES: PaymentType[] = [
  "Cash",
  "UPI",
  "Card",
  "Net Banking",
];

// ===== API Functions =====

export async function createExpense(
  data: ExpenseCreateInput,
): Promise<Expense> {
  return apiFetch<Expense>("/api/v1/expenses/", {
    method: "POST",
    body: data,
  });
}

export async function listExpenses(
  filters?: ExpenseFilters,
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.payment_type) params.set("payment_type", filters.payment_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);

  const query = params.toString();
  const path = query
    ? `/api/v1/expenses/?${query}`
    : "/api/v1/expenses/";

  return apiFetch<ExpenseListResponse>(path);
}

export async function getExpense(id: string): Promise<Expense> {
  return apiFetch<Expense>(`/api/v1/expenses/${id}`);
}

export async function updateExpense(
  id: string,
  data: ExpenseUpdateInput,
): Promise<Expense> {
  return apiFetch<Expense>(`/api/v1/expenses/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/expenses/${id}`, {
    method: "DELETE",
  });
}

// ===== OCR Functions =====

export async function uploadReceiptOcr(
  data: OcrUploadData,
): Promise<OcrResult> {
  return apiFetch<OcrResult>("/api/v1/expenses/ocr", {
    method: "POST",
    body: data,
  });
}

export async function confirmOcrExpense(
  data: OcrConfirmInput,
): Promise<Expense> {
  return apiFetch<Expense>("/api/v1/expenses/ocr/confirm", {
    method: "POST",
    body: data,
  });
}
