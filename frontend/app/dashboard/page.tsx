"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNetBalance, getRecentActivity, type ActivityItem } from "@/lib/api/analytics";
import { formatDateIST } from "@/lib/utils/format-date";
import { useAuthStore } from "@/lib/store/auth-store";

// ===== Presentational Components (extracted in Sprint 5) =====

export function NetBalanceCard({
  totalIncome,
  totalExpenses,
}: {
  totalIncome: number;
  totalExpenses: number;
}) {
  const netBalance = totalIncome - totalExpenses;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Net Balance</CardDescription>
        <CardTitle
          className={`text-3xl ${netBalance >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
        >
          {formatCurrency(netBalance)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">
          {netBalance >= 0 ? "You're in the green!" : "Spending exceeds income"}
        </p>
      </CardContent>
    </Card>
  );
}

export function TotalIncomeCard({ amount }: { amount: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-600" />
          Total Income
        </CardDescription>
        <CardTitle className="text-3xl text-green-600 dark:text-green-500">
          {formatCurrency(amount)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">All income sources</p>
      </CardContent>
    </Card>
  );
}

export function TotalExpensesCard({ amount }: { amount: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-red-600" />
          Total Expenses
        </CardDescription>
        <CardTitle className="text-3xl text-red-600 dark:text-red-500">
          {formatCurrency(amount)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">All expense categories</p>
      </CardContent>
    </Card>
  );
}

export function RecentActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getActivityIcon(item)}</span>
                <div>
                  <p className="font-medium">{getActivityTitle(item)}</p>
                  <p className="text-xs text-zinc-500">
                    {item.type === "expense" && item.paid_to_name ? (
                      <>
                        <span className="font-medium text-zinc-600 dark:text-zinc-400">
                          {item.paid_to_name}
                        </span>
                        {item.description && (
                          <span> · {item.description}</span>
                        )}
                        <span> · {formatDate(item.date)}</span>
                      </>
                    ) : (
                      <>
                        {item.description || "No description"} · {formatDate(item.date)}
                        {item.group_name ? ` · ${item.group_name}` : ""}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold ${item.direction === "in" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
                >
                  {item.direction === "in" ? "+" : "-"}
                  {formatCurrency(item.amount)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {item.type.replace("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Helper Functions =====

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return formatDateIST(dateStr, "date");
}

function getActivityIcon(item: ActivityItem): string {
  if (item.type === "income") return "💰";
  if (item.type === "group_transaction") return "👥";
  return "🛒";
}

function getActivityTitle(item: ActivityItem): string {
  if (item.type === "group_transaction" && item.group_name) {
    return item.group_name;
  }
  return item.description || "Transaction";
}

// ===== Main Component =====

export default function DashboardPage() {
  const { accessToken } = useAuthStore((s) => s);

  const { data: netBalance, isLoading: isLoadingNetBalance, error: netBalanceError } = useQuery({
    queryKey: ["analytics", "net-balance"],
    queryFn: () => getNetBalance(),
    retry: false,
    enabled: !!accessToken, // Wait for token before firing
  });

  const { data: recentActivity, isLoading: isLoadingRecentActivity, error: recentActivityError } = useQuery({
    queryKey: ["analytics", "recent-activity", 10],
    queryFn: () => getRecentActivity(10),
    retry: false,
    enabled: !!accessToken, // Wait for token before firing
  });

  const isLoading = isLoadingNetBalance || isLoadingRecentActivity;
  const hasError = netBalanceError || recentActivityError;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500">Failed to load dashboard data. Please try refreshing.</p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    );
  }

  const totalIncome = netBalance?.total_income ?? 0;
  const totalExpenses = netBalance?.total_expense ?? 0;
  const recentItems = recentActivity?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Overview of your finances
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NetBalanceCard totalIncome={totalIncome} totalExpenses={totalExpenses} />
        <TotalIncomeCard amount={totalIncome} />
        <TotalExpensesCard amount={totalExpenses} />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Transactions
            </CardDescription>
            <CardTitle className="text-3xl">
              {recentItems.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              Recent activity shown
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed items={recentItems} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with FinTrack</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a href="/dashboard/expenses" className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <h3 className="font-medium">Add Expense</h3>
            <p className="text-xs text-zinc-500">Track your spending</p>
          </a>
          <a href="/dashboard/income" className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <h3 className="font-medium">Add Income</h3>
            <p className="text-xs text-zinc-500">Record income sources</p>
          </a>
          <a href="/dashboard/groups" className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <h3 className="font-medium">Create Group</h3>
            <p className="text-xs text-zinc-500">Create Groups with Friends</p>
          </a>
          <a href="/dashboard/analytics" className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <h3 className="font-medium">View Analytics</h3>
            <p className="text-xs text-zinc-500">Detailed reports & charts</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
