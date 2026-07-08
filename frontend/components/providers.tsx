"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { initAuthHooks, refreshAccessToken } from "@/lib/api/client";

// Initialize auth hooks for the API client (once per app lifetime)
let initialized = false;
function initializeAuthHooks() {
  if (initialized) return;
  initAuthHooks({
    getAccessToken: () => useAuthStore.getState().accessToken,
    setAccessToken: (token: string) => {
      useAuthStore.getState().setAccessToken(token);
    },
    clearAuth: () => useAuthStore.getState().clearAuth(),
  });
  initialized = true;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  // Track mount state to prevent SSR/CSR hydration mismatches caused by
  // zustand persist middleware reading localStorage on the client side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    initializeAuthHooks();

    // After a hard reload the access token is gone (in-memory only).
    // If we have a persisted user and a valid refresh_token cookie,
    // silently exchange it for a new access token before any protected
    // API call fires — while showing a loading spinner in the dashboard.
    //
    // Flow:
    //   1. onRehydrateStorage fires synchronously → _hasHydrated = true
    //   2. This subscription sees _hasHydrated and checks auth state
    //   3. If user exists but no accessToken → set isRefreshing=true, call refresh
    //   4. Dashboard layout respects isRefreshing → shows loader, no redirect
    //   5. On success: setAccessToken() clears isRefreshing, WS reconnects
    //   6. On failure: clearAuth() redirects to /login via dashboard guard

    let unsub = () => {};
    let hasAttempted = false;

    const attemptRefresh = async () => {
      const { accessToken, user } = useAuthStore.getState();

      if (!accessToken && user) {
        console.log("[Auth] No access token on reload — attempting silent refresh...");
        useAuthStore.getState().setIsRefreshing(true);

        const newToken = await refreshAccessToken();

        if (newToken) {
          console.log("[Auth] Silent refresh succeeded — access token restored.");
          // setAccessToken already called inside refreshAccessToken via initAuthHooks
        } else {
          console.log("[Auth] Silent refresh failed — clearing auth and redirecting to login.");
          useAuthStore.getState().clearAuth();
        }
        // isRefreshing is cleared by setAccessToken / clearAuth in the store
      }
    };

    // Wait for onRehydrateStorage to signal _hasHydrated, then attempt refresh.
    // onRehydrateStorage fires synchronously at module init, so _hasHydrated may
    // already be true by the time this effect runs — handle both cases.
    const currentState = useAuthStore.getState();
    if (currentState._hasHydrated && !hasAttempted) {
      hasAttempted = true;
      attemptRefresh();
    } else {
      unsub = useAuthStore.subscribe((state) => {
        if (!hasAttempted && state._hasHydrated) {
          hasAttempted = true;
          attemptRefresh();
        }
      });
    }

    return () => unsub();
  }, []);

  // Defer rendering until client-side hydration is complete.
  if (!mounted) return null;

  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
