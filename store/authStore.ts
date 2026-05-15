import { create } from 'zustand';
import { User } from '@/constants/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

// NOTE: Persistence to AsyncStorage will be re-enabled when we rebuild the
// release APK (native AsyncStorage module needs to be compiled in).
// For now this is in-memory only — you'll be logged out on app restart.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: true, // always considered "hydrated" without persist

  setAuth: (user, token) =>
    set({ user, token, isAuthenticated: true }),

  setUser: (user) =>
    set({ user }),

  logout: () =>
    set({ user: null, token: null, isAuthenticated: false }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setHasHydrated: (v) =>
    set({ hasHydrated: v }),
}));
