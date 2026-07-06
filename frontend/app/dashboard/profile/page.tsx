"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User } from "lucide-react";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your account details
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Overview of your FinTrack profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Email
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user?.email ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
