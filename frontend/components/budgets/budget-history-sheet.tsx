"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Edit3,
  Bell,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Zap,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getBudgetHistory, type BudgetHistoryResponse, type DailySpend } from "@/lib/api/budgets";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function formatFieldLabel(field: string): string {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function formatFieldValue(field: string, value: string): string {
  if (field === "amount") {
    const num = parseFloat(value);
    return isNaN(num) ? value : formatCurrency(num);
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Mini bar chart (shared between current + past period daily views)
// ──────────────────────────────────────────────────────────────────────────────

function DailyBars({ rows, compact = false }: { rows: DailySpend[]; compact?: boolean }) {
  const maxAmount = Math.max(...rows.map((d) => d.amount), 0.01);
  return (
    <div className={`space-y-${compact ? "1.5" : "2"}`}>
      {rows.map((row) => (
        <div key={row.date} className="flex items-center gap-2.5">
          <span className={`text-zinc-500 shrink-0 ${compact ? "text-[11px] w-20" : "text-xs w-24"}`}>
            {formatDate(row.date)}
          </span>
          <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min((row.amount / maxAmount) * 100, 100)}%` }}
            />
          </div>
          <span className={`font-medium shrink-0 text-right ${compact ? "text-[11px] w-16" : "text-xs w-20"}`}>
            {formatCurrency(row.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3 text-zinc-500 dark:text-zinc-400">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ──────────────────────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: BudgetHistoryResponse }) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Calendar className="h-4 w-4" />
            <span>Created</span>
          </div>
          <span className="text-sm font-medium">{formatDateTime(data.created_at)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clock className="h-4 w-4" />
            <span>Last updated</span>
          </div>
          <span className="text-sm font-medium">{formatDateTime(data.updated_at)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Edit3 className="h-4 w-4" />
            <span>Total edits</span>
          </div>
          <Badge variant="secondary">{data.edit_logs.length}</Badge>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Bell className="h-4 w-4" />
            <span>Alerts fired</span>
          </div>
          <Badge variant="secondary">{data.alert_logs.length}</Badge>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Edit History Tab
// ──────────────────────────────────────────────────────────────────────────────

function EditHistoryTab({ data }: { data: BudgetHistoryResponse }) {
  if (data.edit_logs.length === 0) {
    return <EmptyState icon={Edit3} message="No edits recorded yet. Changes you make will appear here." />;
  }

  return (
    <div className="space-y-3 p-4">
      {data.edit_logs.map((log, idx) => (
        <div key={idx} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(log.changed_at)}
          </div>
          <div className="space-y-2">
            {log.changes.map((change, ci) => (
              <div key={ci} className="flex items-start gap-2 text-sm">
                <span className="min-w-[70px] text-zinc-500 font-medium shrink-0">
                  {formatFieldLabel(change.field)}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="line-through text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded text-xs">
                    {formatFieldValue(change.field, change.old_value)}
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded text-xs font-medium">
                    {formatFieldValue(change.field, change.new_value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Spending Tab  (current period bars + clickable past periods)
// ──────────────────────────────────────────────────────────────────────────────

function SpendingTab({ data }: { data: BudgetHistoryResponse }) {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-4">
      {/* ── Current period daily breakdown ── */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
          Current Period — Daily Breakdown
        </h4>
        {data.daily_spending.length === 0 ? (
          <EmptyState icon={TrendingUp} message="No spending yet in the current period." />
        ) : (
          <DailyBars rows={data.daily_spending} />
        )}
      </div>

      {/* ── Past periods ── */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
          Past Periods <span className="font-normal text-zinc-400 text-xs">(click to expand)</span>
        </h4>
        {data.past_periods.length === 0 ? (
          <EmptyState icon={Calendar} message="No past period data available." />
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
            {data.past_periods.map((p) => {
              const pct = p.budget_amount > 0 ? (p.spent / p.budget_amount) * 100 : 0;
              const isOver = p.spent > p.budget_amount;
              const isExpanded = expandedPeriod === p.period_anchor;
              const hasDetail = p.daily_breakdown.length > 0;

              return (
                <div key={p.period_anchor}>
                  {/* Row — always visible */}
                  <button
                    onClick={() =>
                      hasDetail
                        ? setExpandedPeriod(isExpanded ? null : p.period_anchor)
                        : undefined
                    }
                    className={`w-full px-4 py-3 space-y-1.5 text-left transition-colors ${
                      hasDetail ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        {hasDetail ? (
                          isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          )
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span className="font-medium">{p.period_anchor}</span>
                      </div>
                      <span className={`${isOver ? "text-red-600 dark:text-red-400 font-semibold" : "text-zinc-600 dark:text-zinc-400"}`}>
                        {formatCurrency(p.spent)} / {formatCurrency(p.budget_amount)}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden ml-5">
                      <div
                        className={`h-full rounded-full ${isOver ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </button>

                  {/* Expanded daily detail */}
                  {isExpanded && hasDetail && (
                    <div className="px-4 pb-4 pt-2 bg-zinc-50/70 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
                      <DailyBars rows={p.daily_breakdown} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Analytics Tab  (spending graph + burn rate forecast)
// ──────────────────────────────────────────────────────────────────────────────

function AnalyticsTab({ data, budgetAmount }: { data: BudgetHistoryResponse; budgetAmount: number }) {
  // ── Burn rate forecast ──
  const forecast = useMemo(() => {
    const rows = data.daily_spending;
    if (rows.length === 0 || budgetAmount <= 0) return null;

    const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
    const daysElapsed = rows.length;
    const dailyAvg = totalSpent / daysElapsed;

    // Infer period length from context (use 30 days as safe fallback — exact calc needs period type)
    // We'll derive from past periods anchor format if available
    let periodDays = 30;
    if (data.past_periods.length > 0) {
      const anchor = data.past_periods[0].period_anchor;
      if (/^\d{4}$/.test(anchor)) periodDays = 365;          // yearly
      else if (/Q\d$/.test(anchor)) periodDays = 91;          // quarterly
      else if (/^\d{4}-\d{2}$/.test(anchor)) periodDays = 30; // monthly
      else periodDays = 1;                                      // daily
    }

    const daysRemaining = Math.max(periodDays - daysElapsed, 0);
    const projected = totalSpent + dailyAvg * daysRemaining;
    const safeDaily = budgetAmount / periodDays;
    const burnRatio = dailyAvg / safeDaily;

    return { totalSpent, daysElapsed, daysRemaining, dailyAvg, projected, safeDaily, burnRatio, periodDays };
  }, [data.daily_spending, data.past_periods, budgetAmount]);

  const statusColor = !forecast
    ? "text-zinc-500"
    : forecast.burnRatio <= 1.0
    ? "text-green-600 dark:text-green-400"
    : forecast.burnRatio <= 1.3
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400";

  const statusLabel = !forecast
    ? "—"
    : forecast.burnRatio <= 1.0
    ? "On track 🟢"
    : forecast.burnRatio <= 1.3
    ? "At risk 🟡"
    : "Over pace 🔴";

  // ── Spending graph ── (cumulative daily, shows trajectory vs budget ceiling)
  const cumulativeRows = useMemo(() => {
    let running = 0;
    return data.daily_spending.map((row) => {
      running += row.amount;
      return { date: row.date, cumulative: running };
    });
  }, [data.daily_spending]);

  const maxY = Math.max(budgetAmount, ...cumulativeRows.map((r) => r.cumulative), 0.01);

  return (
    <div className="space-y-6 p-4">

      {/* ── Spending trajectory graph ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Cumulative Spending
          </h4>
        </div>

        {cumulativeRows.length === 0 ? (
          <EmptyState icon={BarChart2} message="No spending data yet for this period." />
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            {/* SVG-like bar chart via CSS */}
            <div className="relative">
              {/* Budget ceiling line label */}
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>0</span>
                <span className="text-orange-500 font-medium">Budget: {formatCurrency(budgetAmount)}</span>
              </div>
              {/* Bars */}
              <div className="flex items-end gap-1 h-24 border-b border-zinc-200 dark:border-zinc-700">
                {cumulativeRows.map((row, i) => {
                  const heightPct = Math.min((row.cumulative / maxY) * 100, 100);
                  const isNearLimit = row.cumulative / budgetAmount >= 0.8;
                  const isOver = row.cumulative > budgetAmount;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end group relative"
                      title={`${formatDate(row.date)}: ${formatCurrency(row.cumulative)}`}
                    >
                      <div
                        className={`rounded-t transition-all ${
                          isOver ? "bg-red-500" : isNearLimit ? "bg-yellow-500" : "bg-blue-500"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap bg-zinc-800 text-white text-[10px] px-1.5 py-1 rounded pointer-events-none">
                        {formatDate(row.date)}<br />{formatCurrency(row.cumulative)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Budget ceiling marker line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-orange-400 pointer-events-none"
                style={{ bottom: `${Math.min((budgetAmount / maxY) * 100, 100)}%` }}
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>{cumulativeRows[0]?.date}</span>
                <span>{cumulativeRows[cumulativeRows.length - 1]?.date}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Under 80%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" />80–100%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Exceeded</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-orange-400 inline-block" />Budget limit</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Burn rate forecast ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-yellow-500" />
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Burn Rate Forecast
          </h4>
        </div>

        {!forecast ? (
          <EmptyState icon={Zap} message="No spending data yet to forecast." />
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-zinc-500">Status</span>
              <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-zinc-500">Daily avg so far</span>
              <span className="font-medium">{formatCurrency(forecast.dailyAvg)}/day</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-zinc-500">Safe daily limit</span>
              <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(forecast.safeDaily)}/day</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-zinc-500">Days remaining</span>
              <span className="font-medium">{forecast.daysRemaining} day{forecast.daysRemaining !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-zinc-500">Projected end-of-period</span>
              <div className="text-right">
                <span className={`font-semibold ${forecast.projected > budgetAmount ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {formatCurrency(forecast.projected)}
                </span>
                {forecast.projected > budgetAmount && (
                  <div className="text-[10px] text-red-500">
                    +{formatCurrency(forecast.projected - budgetAmount)} over budget
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Alert History Tab
// ──────────────────────────────────────────────────────────────────────────────

function AlertHistoryTab({ data }: { data: BudgetHistoryResponse }) {
  if (data.alert_logs.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        message="No alerts fired yet. Alerts appear here when 80% or 100% of the budget is reached."
      />
    );
  }

  return (
    <div className="space-y-3 p-4">
      {data.alert_logs.map((log, idx) => {
        const pct = log.budget_amount > 0
          ? Math.round((log.spend_at_alert / log.budget_amount) * 100 * 10) / 10
          : 0;
        const is100 = log.threshold === "100";

        return (
          <div
            key={idx}
            className={`rounded-lg border p-4 space-y-2 ${
              is100
                ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${is100 ? "text-red-500" : "text-yellow-500"}`} />
                <span className="text-sm font-semibold">
                  {is100 ? "Budget Exceeded (100%)" : "Budget Alert (80%)"}
                </span>
              </div>
              <Badge
                variant="outline"
                className={is100 ? "border-red-400 text-red-600" : "border-yellow-500 text-yellow-700"}
              >
                {log.threshold}%
              </Badge>
            </div>
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatDateTime(log.fired_at)}
            </div>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              Spent{" "}
              <span className="font-medium">{formatCurrency(log.spend_at_alert)}</span>
              {" "}of{" "}
              <span className="font-medium">{formatCurrency(log.budget_amount)}</span>
              {" "}
              <span className="text-zinc-500">({pct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

interface BudgetHistorySheetProps {
  budgetId: string | null;
  budgetLabel: string;
  budgetAmount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function BudgetHistorySheet({
  budgetId,
  budgetLabel,
  budgetAmount,
  isOpen,
  onClose,
}: BudgetHistorySheetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["budget-history", budgetId],
    queryFn: () => getBudgetHistory(budgetId!),
    enabled: isOpen && !!budgetId,
    staleTime: 30_000,
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 w-full sm:w-[480px]">
        <SheetHeader className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500 shrink-0" />
            <SheetTitle className="text-base">{budgetLabel} — History</SheetTitle>
          </div>
          <SheetDescription>Full activity log for this budget</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-zinc-500">Failed to load budget history. Please try again.</p>
            </div>
          )}

          {data && (
            <Tabs defaultValue="overview" className="flex flex-col h-full">
              <div className="px-3 pt-3 pb-0 border-b border-zinc-200 dark:border-zinc-800">
                <TabsList className="w-full grid grid-cols-5 h-auto">
                  <TabsTrigger value="overview" className="text-[11px] py-2 px-1">Overview</TabsTrigger>
                  <TabsTrigger value="edits" className="text-[11px] py-2 px-1">
                    Edits
                    {data.edit_logs.length > 0 && (
                      <span className="ml-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full px-1.5 py-0.5 text-[9px]">
                        {data.edit_logs.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="spending" className="text-[11px] py-2 px-1">Spending</TabsTrigger>
                  <TabsTrigger value="analytics" className="text-[11px] py-2 px-1">Analytics</TabsTrigger>
                  <TabsTrigger value="alerts" className="text-[11px] py-2 px-1">
                    Alerts
                    {data.alert_logs.length > 0 && (
                      <span className="ml-1 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full px-1.5 py-0.5 text-[9px]">
                        {data.alert_logs.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto">
                <OverviewTab data={data} />
              </TabsContent>
              <TabsContent value="edits" className="mt-0 flex-1 overflow-y-auto">
                <EditHistoryTab data={data} />
              </TabsContent>
              <TabsContent value="spending" className="mt-0 flex-1 overflow-y-auto">
                <SpendingTab data={data} />
              </TabsContent>
              <TabsContent value="analytics" className="mt-0 flex-1 overflow-y-auto">
                <AnalyticsTab data={data} budgetAmount={budgetAmount} />
              </TabsContent>
              <TabsContent value="alerts" className="mt-0 flex-1 overflow-y-auto">
                <AlertHistoryTab data={data} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
