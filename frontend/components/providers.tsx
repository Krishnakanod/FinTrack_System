"use client";

import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/auth-store";
import { initAuthHooks } from "@/lib/api/client";

// Initialize auth hooks for the API client
let initialized = false;
function initializeAuthHooks() {
  if (initialized) return;
  initAuthHooks({
    getAccessToken: () => useAuthStore.getState().accessToken,
    setAccessToken: (token: string) => {
      useAuthStore.setState({ accessToken: token });
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

  useEffect(() => {
    initializeAuthHooks();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
