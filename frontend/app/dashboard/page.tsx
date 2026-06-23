import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Balance</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget Status</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with FinTrack</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 p-4 opacity-50 dark:border-zinc-800">
            <h3 className="font-medium">Add Expense</h3>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 opacity-50 dark:border-zinc-800">
            <h3 className="font-medium">Add Income</h3>
            <p className="text-xs text-zinc-500">Coming soon</p>
          </div>
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
