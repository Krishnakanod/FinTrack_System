// FinTrack Analytics API functions
// Per Spec-09 §1.6

import { apiFetch } from "./client";

// ===== Types =====

export type AnalyticsPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export interface DateRange {
  start: string;
  end: string;
}

export interface PersonalSummary {
  total_expenses: number;
  total_income: number;
  net_balance: number;
  savings_rate: number | null;
}

export interface IncomeExpenseBucket {
  label: string;
  income: number;
  expense: number;
}

export interface TrendBucket {
  label: string;
  amount: number;
}

export interface PaymentTypeBreakdown {
  payment_type: string;
  total_amount: number;
  percentage: number;
}

export interface TopCategory {
  rank: number;
  category: string;
  total_amount: number;
}

export interface PersonalAnalyticsResponse {
  period: AnalyticsPeriod;
  range: DateRange;
  summary: PersonalSummary;
  income_vs_expense: IncomeExpenseBucket[];
  spending_trend: TrendBucket[];
  payment_type_breakdown: PaymentTypeBreakdown[];
  top_categories: TopCategory[];
  recent_activity: ActivityItem[];
}

export interface MemberContribution {
  member_id: string;
  member_name: string;
  paid: number;
  owed: number;
}

export interface UnsettledSettledItem {
  label: string;
  amount: number;
}

export interface GroupSummary {
  total_spend: number;
  your_contribution: number;
  unsettled_amount: number;
  settled_amount: number;
}

export interface GroupAnalyticsResponse {
  period: AnalyticsPeriod;
  range: DateRange;
  summary: GroupSummary;
  unsettled_vs_settled: UnsettledSettledItem[];
  per_member_contribution: MemberContribution[];
  spending_trend: TrendBucket[];
  recent_activity: ActivityItem[];
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
  paid_to_name?: string | null;
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

export async function getPersonalAnalytics(
  period: AnalyticsPeriod,
): Promise<PersonalAnalyticsResponse> {
  return apiFetch<PersonalAnalyticsResponse>(
    `/api/v1/analytics/personal?period=${period}`,
  );
}

export async function getGroupAnalytics(
  groupId: string,
  period: AnalyticsPeriod,
): Promise<GroupAnalyticsResponse> {
  return apiFetch<GroupAnalyticsResponse>(
    `/api/v1/analytics/group?group_id=${groupId}&period=${period}`,
  );
}

export async function getExpenseBreakdown(
  period: AnalyticsPeriod,
): Promise<BreakdownResponse> {
  return apiFetch<BreakdownResponse>(`/api/v1/analytics/expenses?period=${period}`);
}

export async function getIncomeBreakdown(
  period: AnalyticsPeriod,
): Promise<BreakdownResponse> {
  return apiFetch<BreakdownResponse>(`/api/v1/analytics/income?period=${period}`);
}

export async function getNetBalance(): Promise<NetBalance> {
  return apiFetch<NetBalance>(`/api/v1/analytics/net-balance`);
}

export async function getRecentActivity(
  limit = 10,
  mode: "all" | "personal" | "group" = "all",
): Promise<RecentActivityResponse> {
  return apiFetch<RecentActivityResponse>(
    `/api/v1/analytics/recent-activity?limit=${limit}&mode=${mode}`,
  );
}

export async function downloadReport(data: ReportDownloadInput): Promise<void> {
  // downloadReport returns a binary blob, not JSON, so keep a raw fetch here
  // but still attach the current access token manually.
  const { useAuthStore } = await import("@/lib/store/auth-store");
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/v1/reports/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
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
