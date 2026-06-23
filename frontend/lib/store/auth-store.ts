"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Whether the persist middleware has finished hydrating from localStorage */
  _hasHydrated: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setAuth: (accessToken, user) =>
        set({
          accessToken,
          user,
          isAuthenticated: true,
        }),

      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "fintrack-auth",
      // Only persist user — accessToken must NOT survive a hard reload
      // (security requirement per Spec-03 §1.1)
      partialize: (state) => ({ user: state.user }),
      storage: createJSONStorage(() => localStorage),
      // Track hydration completion so consumers can wait for it
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recompute isAuthenticated from persisted user
          if (state.user) {
            state.setAuth(null as any, state.user);
          }
          // Use setTimeout to ensure this fires after the initial render
          setTimeout(() => {
            useAuthStore.setState({ _hasHydrated: true });
          }, 0);
        }
      },
    },
  ),
);
