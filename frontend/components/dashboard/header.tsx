"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { logout } from "@/lib/api/auth";

export function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Logout API might fail if cookie expired, but we still clear local state
    } finally {
      clearAuth();
      toast.success("Logged out successfully");
      router.push("/login");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
      </h2>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
            <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </div>
          <span className="hidden text-sm font-medium text-zinc-900 sm:inline dark:text-zinc-50">
            {user?.name || user?.email || "User"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </header>
  );
}
