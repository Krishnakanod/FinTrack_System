"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listExpenses, type Expense } from "@/lib/api/expenses";
import { listIncome, type Income } from "@/lib/api/income";

// ===== Presentational Components (for Sprint 9 swap) =====

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

export function RecentActivityFeed({
  expenses,
  incomes,
}: {
  expenses: Expense[];
  incomes: Income[];
}) {
  const recentActivity = useMemo(() => {
    const combined = [
      ...expenses.map((e) => ({
        type: "expense" as const,
        id: e.id,
        title: e.category,
        description: e.description || "No description",
        amount: e.amount,
        date: e.date,
        payment_type: e.payment_type,
        icon: getCategoryIcon(e.category),
      })),
      ...incomes.map((i) => ({
        type: "income" as const,
        id: i.id,
        title: i.source_type === "salary" ? "Salary" : "From Friend",
        description: i.description || "No description",
        amount: i.amount,
        date: i.date,
        payment_type: i.payment_type,
        icon: i.source_type === "salary" ? "💰" : "👥",
      })),
    ];

    return combined
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [expenses, incomes]);

  if (recentActivity.length === 0) {
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
          {recentActivity.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-zinc-500">
                    {item.description} • {formatDate(item.date)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold ${item.type === "income" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
                >
                  {item.type === "income" ? "+" : "-"}
                  {formatCurrency(item.amount)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {item.payment_type}
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
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Food: "🍔",
    Transport: "🚗",
    Shopping: "🛍️",
    Entertainment: "🎬",
    Health: "💊",
    Utilities: "💡",
    Other: "📦",
  };
  return icons[category] || "📦";
}

// ===== Main Component =====

export default function DashboardPage() {
  // Fetch expenses and income
  const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => listExpenses(),
  });

  const { data: incomeData, isLoading: isLoadingIncome } = useQuery({
    queryKey: ["income"],
    queryFn: () => listIncome(),
  });

  const expenses = expensesData?.items ?? [];
  const incomes = incomeData?.items ?? [];

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const totalIncome = useMemo(
    () => incomes.reduce((sum, i) => sum + i.amount, 0),
    [incomes]
  );

  const isLoading = isLoadingExpenses || isLoadingIncome;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

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
              {expenses.length + incomes.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {expenses.length} expenses, {incomes.length} income
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed expenses={expenses} incomes={incomes} />

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
          <div className="rounded-lg border border-zinc-200 p-4 opacity-50 dark:border-zinc-800">
            <h3 className="font-medium">Create Group</h3>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 opacity-50 dark:border-zinc-800">
            <h3 className="font-medium">View Analytics</h3>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
