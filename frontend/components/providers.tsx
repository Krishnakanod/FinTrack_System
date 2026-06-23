"use client";

import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
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
  useEffect(() => {
    initializeAuthHooks();
  }, []);

  return (
    <>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
