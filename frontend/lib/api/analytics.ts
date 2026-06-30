// FinTrack Analytics API functions
// Per Spec-09 §1.6

import { useAuthStore } from "@/lib/store/auth-store";
import { API_BASE_URL } from "./client";

// ===== Types =====

export type AnalyticsPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export interface DateRange {
  start: string;
  end: string;
}

export interface BreakdownItem {
  category?: string;
  source_type?: string;
  total_amount: number;
  percentage: number;
}

export interface BreakdownResponse {
  period: AnalyticsPeriod;
  range: DateRange;
  breakdown: BreakdownItem[];
  total: number;
}

export interface NetBalance {
  total_income: number;
  total_expense: number;
  net_balance: number;
}

export interface ActivityItem {
  type: "expense" | "income" | "group_transaction";
  id: string;
  description: string;
  amount: number;
  date: string;
  direction: "in" | "out";
  group_id: string | null;
  group_name: string | null;
}

export interface RecentActivityResponse {
  items: ActivityItem[];
}

export interface ReportDownloadInput {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  format: "pdf" | "excel";
}

// ===== API Functions =====

export async function getExpenseBreakdown(
  period: AnalyticsPeriod,
): Promise<BreakdownResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/analytics/expenses?period=${period}`, {
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ""}`,
    },
    credentials: "include",
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getIncomeBreakdown(
  period: AnalyticsPeriod,
): Promise<BreakdownResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/analytics/income?period=${period}`, {
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ""}`,
    },
    credentials: "include",
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getNetBalance(): Promise<NetBalance> {
  const res = await fetch(`${API_BASE_URL}/api/v1/analytics/net-balance`, {
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ""}`,
    },
    credentials: "include",
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getRecentActivity(limit = 10): Promise<RecentActivityResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/analytics/recent-activity?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ""}`,
      },
      credentials: "include",
    },
  );
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function downloadReport(data: ReportDownloadInput): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reports/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ""}`,
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!res.ok) {
    throw await res.json();
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition");
  let filename = "fintrack-report";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
