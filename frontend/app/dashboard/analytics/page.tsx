"use client";

import { useState } from "react";
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
} from "recharts";
import { Download, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getExpenseBreakdown,
  getIncomeBreakdown,
  getNetBalance,
  getRecentActivity,
  downloadReport,
  type AnalyticsPeriod,
} from "@/lib/api/analytics";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("monthly");
  const [reportStart, setReportStart] = useState<string>("");
  const [reportEnd, setReportEnd] = useState<string>("");
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel">("pdf");
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: expenseData } = useQuery({
    queryKey: ["analytics", "expenses", period],
    queryFn: () => getExpenseBreakdown(period),
  });

  const { data: incomeData } = useQuery({
    queryKey: ["analytics", "income", period],
    queryFn: () => getIncomeBreakdown(period),
  });

  const { data: netBalance } = useQuery({
    queryKey: ["analytics", "net-balance"],
    queryFn: () => getNetBalance(),
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["analytics", "recent-activity", 10],
    queryFn: () => getRecentActivity(10),
  });

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
      toast.success("Report download started.");
    } catch (error: any) {
      toast.error(error.message || "Failed to download report.");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Analytics
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Visual breakdown of your finances
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(value) => setPeriod(value as AnalyticsPeriod)}>
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
          <DownloadReportDialog
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
      </div>

      {/* Net Balance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-500">
              {formatCurrency(netBalance?.total_income ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-500">
              {formatCurrency(netBalance?.total_expense ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Balance</CardDescription>
            <CardTitle
              className={`text-3xl ${(netBalance?.net_balance ?? 0) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
            >
              {formatCurrency(netBalance?.net_balance ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>By category for {PERIODS.find((p) => p.value === period)?.label}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData?.breakdown ?? []}
                  dataKey="total_amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props: any) => `${props.payload.category} ${props.payload.percentage}%`}
                >
                  {(expenseData?.breakdown ?? []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
            <CardDescription>For {PERIODS.find((p) => p.value === period)?.label}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Income", amount: incomeData?.total ?? 0 },
                  { name: "Expenses", amount: expenseData?.total ?? 0 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Income Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Income Sources</CardTitle>
          <CardDescription>By source type for {PERIODS.find((p) => p.value === period)?.label}</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={incomeData?.breakdown ?? []}
              layout="vertical"
              margin={{ left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="source_type" type="category" />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="total_amount" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest transactions across all sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(recentActivity?.items ?? []).length === 0 && (
              <p className="text-sm text-zinc-500">No recent activity.</p>
            )}
            {(recentActivity?.items ?? []).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                <p className="font-medium">{item.description || "Transaction"}</p>
                <p className="text-xs text-zinc-500">
                    {item.type.replace("_", " ")}
                    {item.group_name ? ` • ${item.group_name}` : ""}
                  </p>
                </div>
                <p
                  className={`font-semibold ${item.direction === "in" ? "text-green-600" : "text-red-600"}`}
                >
                  {item.direction === "in" ? "+" : "-"}
                  {formatCurrency(item.amount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DownloadReportDialog({
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Download Report</DialogTitle>
          <DialogDescription>
            Select a date range and format for your financial report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <input
                id="start-date"
                type="date"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <input
                id="end-date"
                type="date"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
              />
            </div>
          </div>
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
          <Button onClick={onDownload} disabled={isDownloading} className="w-full">
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
