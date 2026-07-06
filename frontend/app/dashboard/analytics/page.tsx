"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Download, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getPersonalAnalytics,
  getGroupAnalytics,
  getRecentActivity,
  downloadReport,
  type AnalyticsPeriod,
  type PersonalAnalyticsResponse,
  type GroupAnalyticsResponse,
  type ActivityItem,
} from "@/lib/api/analytics";
import { listGroups, type Group } from "@/lib/api/groups";
import { DateRangePicker } from "@/components/ui/date-range-picker";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div>
        <p className="font-medium">{item.description || "Transaction"}</p>
        <p className="text-xs text-zinc-500">
          {item.type.replace("_", " ")}
          {item.group_name ? ` • ${item.group_name}` : ""}
        </p>
      </div>
      <p className={`font-semibold ${item.direction === "in" ? "text-green-600" : "text-red-600"}`}>
        {item.direction === "in" ? "+" : "-"}
        {formatCurrency(item.amount)}
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = searchParams.get("tab") === "group" ? "group" : "personal";
  const initialGroupId = searchParams.get("groupId") ?? "";

  const [tab, setTab] = useState<"personal" | "group">(initialTab);
  const [period, setPeriod] = useState<AnalyticsPeriod>("monthly");
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);

  const [reportStart, setReportStart] = useState<string>("");
  const [reportEnd, setReportEnd] = useState<string>("");
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel">("pdf");
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: listGroups,
  });

  const groups = groupsData?.items ?? [];

  const { data: personalData, isLoading: isPersonalLoading } = useQuery({
    queryKey: ["analytics", "personal", period],
    queryFn: () => getPersonalAnalytics(period),
    enabled: tab === "personal",
  });

  const { data: groupData, isLoading: isGroupLoading } = useQuery({
    queryKey: ["analytics", "group", selectedGroupId, period],
    queryFn: () => getGroupAnalytics(selectedGroupId, period),
    enabled: tab === "group" && Boolean(selectedGroupId),
  });

  // Sync tab/groupId with URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "group" && selectedGroupId) {
      params.set("groupId", selectedGroupId);
    }
    router.replace(`/dashboard/analytics?${params.toString()}`, { scroll: false });
  }, [tab, selectedGroupId, router]);

  const handleDownload = async () => {
    if (!reportStart || !reportEnd) {
      toast.error("Please select a date range.");
      return;
    }
    if (reportStart > reportEnd) {
      toast.error("Start date must be before end date.");
      return;
    }
    setIsDownloading(true);
    try {
      await downloadReport({
        start_date: reportStart,
        end_date: reportEnd,
        format: reportFormat,
      });
      toast.success("Report downloaded.");
    } catch (error: any) {
      toast.error(error.message || "Failed to download report.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Analytics</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Visual breakdown of your finances
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "personal" | "group")}>
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Select value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DownloadReportPanel
          reportStart={reportStart}
          setReportStart={setReportStart}
          reportEnd={reportEnd}
          setReportEnd={setReportEnd}
          reportFormat={reportFormat}
          setReportFormat={setReportFormat}
          isDownloading={isDownloading}
          onDownload={handleDownload}
        />
      </div>

      {tab === "personal" ? (
        <PersonalAnalytics data={personalData} isLoading={isPersonalLoading} />
      ) : (
        <GroupAnalytics
          data={groupData}
          isLoading={isGroupLoading}
          groups={groups}
          selectedGroupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
        />
      )}
    </div>
  );
}

function PersonalAnalytics({
  data,
  isLoading,
}: {
  data?: PersonalAnalyticsResponse;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total Expenses" amount={summary?.total_expenses ?? 0} color="text-red-600" />
        <SummaryCard title="Total Income" amount={summary?.total_income ?? 0} color="text-green-600" />
        <SummaryCard title="Net Balance" amount={summary?.net_balance ?? 0} color={summary && summary.net_balance >= 0 ? "text-green-600" : "text-red-600"} />
        <SummaryCard
          title="Savings Rate"
          amount={summary?.savings_rate ?? 0}
          suffix="%"
          color="text-blue-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
            <CardDescription>Comparison by {data?.period}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.income_vs_expense ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending Trend</CardTitle>
            <CardDescription>Total expense over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.spending_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Type Breakdown</CardTitle>
            <CardDescription>Spending by payment method</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.payment_type_breakdown ?? []}
                  dataKey="total_amount"
                  nameKey="payment_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ payment_type, percentage }: any) => `${payment_type} ${percentage}%`}
                >
                  {(data?.payment_type_breakdown ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 3 Spending Categories</CardTitle>
            <CardDescription>By total spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.top_categories ?? []).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">
                      #{cat.rank} {cat.category}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(cat.total_amount)}</span>
                </div>
              ))}
              {(data?.top_categories ?? []).length === 0 && (
                <p className="text-sm text-zinc-500">No category data available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last 10 transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.recent_activity ?? []).map((item) => (
              <ActivityItemRow key={`${item.type}-${item.id}`} item={item} />
            ))}
            {(data?.recent_activity ?? []).length === 0 && (
              <p className="text-sm text-zinc-500">No recent activity.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupAnalytics({
  data,
  isLoading,
  groups,
  selectedGroupId,
  onGroupChange,
}: {
  data?: GroupAnalyticsResponse;
  isLoading: boolean;
  groups: Group[];
  selectedGroupId: string;
  onGroupChange: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="w-full sm:w-80">
        <Label>Group</Label>
        <Select value={selectedGroupId} onValueChange={onGroupChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedGroupId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-zinc-500">Select a group to view its analytics.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="Total Group Spend" amount={data?.summary.total_spend ?? 0} color="text-zinc-900" />
            <SummaryCard title="Your Contribution" amount={data?.summary.your_contribution ?? 0} color="text-blue-600" />
            <SummaryCard title="Unsettled" amount={data?.summary.unsettled_amount ?? 0} color="text-orange-600" />
            <SummaryCard title="Settled" amount={data?.summary.settled_amount ?? 0} color="text-green-600" />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Unsettled vs Settled</CardTitle>
                <CardDescription>Group split status</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.unsettled_vs_settled ?? []}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ label, amount }: any) => `${label}: ${formatCurrency(amount)}`}
                    >
                      {(data?.unsettled_vs_settled ?? []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? "#f59e0b" : "#10b981"}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Per-Member Contribution</CardTitle>
                <CardDescription>Paid vs owed</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.per_member_contribution ?? []} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="member_name" type="category" />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="paid" name="Paid" fill="#3b82f6" />
                    <Bar dataKey="owed" name="Owed" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Group Spending Trend</CardTitle>
              <CardDescription>Total group spend over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.spending_trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="amount" stroke="#8b5cf6" dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Group Activity</CardTitle>
              <CardDescription>Last 10 group transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(data?.recent_activity ?? []).map((item) => (
                  <ActivityItemRow key={`${item.type}-${item.id}`} item={item} />
                ))}
                {(data?.recent_activity ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500">No recent activity.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  color,
  suffix = "",
}: {
  title: string;
  amount: number;
  color: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-3xl ${color}`}>
          {suffix ? `${amount}${suffix}` : formatCurrency(amount)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function DownloadReportPanel({
  reportStart,
  setReportStart,
  reportEnd,
  setReportEnd,
  reportFormat,
  setReportFormat,
  isDownloading,
  onDownload,
}: {
  reportStart: string;
  setReportStart: (value: string) => void;
  reportEnd: string;
  setReportEnd: (value: string) => void;
  reportFormat: "pdf" | "excel";
  setReportFormat: (value: "pdf" | "excel") => void;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-end">
      <DateRangePicker
        from={reportStart}
        to={reportEnd}
        onFromChange={setReportStart}
        onToChange={setReportEnd}
        fromLabel="Start Date"
        toLabel="End Date"
      />
      <div className="space-y-2">
        <Label>Format</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="format"
              value="pdf"
              checked={reportFormat === "pdf"}
              onChange={() => setReportFormat("pdf")}
            />
            PDF
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="format"
              value="excel"
              checked={reportFormat === "excel"}
              onChange={() => setReportFormat("excel")}
            />
            Excel
          </label>
        </div>
      </div>
      <Button onClick={onDownload} disabled={isDownloading}>
        {isDownloading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </>
        )}
      </Button>
    </div>
  );
}
