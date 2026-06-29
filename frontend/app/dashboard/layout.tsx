"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/lib/store/auth-store";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { useWebSocket } from "@/lib/websocket";
import { WebSocketEventListener } from "@/components/dashboard/websocket-event-listener";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket connection — auto-connects when authenticated (Spec-06 §1.9)
  useWebSocket();

  useEffect(() => {
    // Wait for Zustand persist hydration to complete before checking auth
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    setIsLoading(false);
  }, [user, hasHydrated, router]);

  // Show loading state while checking auth / waiting for hydration
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — don't render children (redirect is happening)
  if (!user) {
    return null;
  }

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
