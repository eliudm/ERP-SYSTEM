import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; role: string; posOnly: boolean; firstName: string; lastName: string } | null;
  profile: User | null;
  isAuthenticated: boolean;
  posVerified: boolean;
  posLastClosedDate: string | null;
  posSessionId: string | null;
  setAuth: (token: string, user: any) => void;
  setProfile: (profile: User) => void;
  setPosVerified: (verified: boolean) => void;
  setPosLastClosedDate: (date: string) => void;
  setPosSessionId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      profile: null,
      isAuthenticated: false,
      posVerified: false,
      posLastClosedDate: null,
      posSessionId: null,

      setAuth: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      setProfile: (profile) => set({ profile }),

      setPosVerified: (verified) => set({ posVerified: verified }),

      setPosLastClosedDate: (date) => set({ posLastClosedDate: date }),

      setPosSessionId: (id) => set({ posSessionId: id }),

      logout: () =>
        set({
          token: null,
          user: null,
          profile: null,
          isAuthenticated: false,
          posVerified: false,
          posSessionId: null,
        }),
    }),
    {
      name: 'erp-auth',
      // posVerified is intentionally excluded — must re-verify after page refresh
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
        posLastClosedDate: state.posLastClosedDate,
      }),
    },
  ),
);