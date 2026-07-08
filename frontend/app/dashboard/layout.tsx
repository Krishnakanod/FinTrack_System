"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/lib/store/auth-store";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { WebSocketEventListener } from "@/components/dashboard/websocket-event-listener";
import { useWebSocket } from "@/lib/websocket";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const forceHydrate = useAuthStore((s) => s.forceHydrate);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isRefreshing = useAuthStore((s) => s.isRefreshing);

  // MUST be called unconditionally — Rules of Hooks.
  // The hook self-guards: it skips connection when isAuthenticated/accessToken are absent.
  useWebSocket();

  // Safety net: force-derive isAuthenticated from user if onRehydrateStorage
  // hasn't already done so (e.g. very first visit with no localStorage data).
  useEffect(() => {
    forceHydrate();
  }, [forceHydrate]);

  // Redirect to login only when:
  //   • hydration is settled (not still refreshing), AND
  //   • there is no user in state
  // This prevents the premature redirect that caused the reload logout bug.
  useEffect(() => {
    if (!isRefreshing && !user) {
      console.log("[DashboardLayout] Not authenticated after refresh attempt — redirecting to /login");
      router.replace("/login");
    }
  }, [user, isRefreshing, router]);

  // Show loader while:
  //   • a silent token refresh is in-flight (isRefreshing), OR
  //   • hydration hasn't settled yet and we have no user
  if (isRefreshing || (!user && !isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // All checks passed — render the dashboard shell
  return (
    <>
      <WebSocketEventListener />
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 pt-20 lg:pt-6">{children}</main>
        </div>
      </div>
    </>
  );
}
