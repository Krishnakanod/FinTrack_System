"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  name: string;
  avatar_url: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** Derived from user — true iff user != null */
  isAuthenticated: boolean;
  /** Whether the persist middleware has finished hydrating from localStorage */
  _hasHydrated: boolean;
  /** True while a silent token refresh is in-flight — prevents premature logout redirect */
  isRefreshing: boolean;

  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  /** Force-set hydrated (called from useEffect on mount as a safety net) */
  forceHydrate: () => void;
  setIsRefreshing: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      isRefreshing: false,

      setAuth: (accessToken, user) =>
        set({
          accessToken,
          user,
          isAuthenticated: true,
          _hasHydrated: true,
          isRefreshing: false,
        }),

      setAccessToken: (accessToken) =>
        set({
          accessToken,
          isRefreshing: false,
        }),

      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
          isRefreshing: false,
        }),

      forceHydrate: () =>
        set((state) => ({
          _hasHydrated: true,
          // Derive isAuthenticated from user — single source of truth
          isAuthenticated: !!state.user,
        })),

      setIsRefreshing: (v) => set({ isRefreshing: v }),
    }),
    {
      name: "fintrack-auth",
      // Only persist user — accessToken must NOT survive a hard reload (security)
      // isAuthenticated is derived from user so we persist it too for immediate
      // synchronous access on reload (avoids the flash-redirect-to-login bug).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: !!state.user,
      }),
      storage: createJSONStorage(() => localStorage),
      // Auto-set _hasHydrated once the persist middleware finishes reading localStorage.
      // This fires before any React component renders, eliminating the race between
      // providers.tsx refresh attempt and dashboard/layout.tsx redirect guard.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
          // Re-derive isAuthenticated from user in case localStorage had stale value
          state.isAuthenticated = !!state.user;
        }
      },
    },
  ),
);
