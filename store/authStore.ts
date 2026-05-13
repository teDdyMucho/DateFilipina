import { create } from 'zustand';
import { User } from '@/constants/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: (user, token) =>
    set({ user, token, isAuthenticated: true }),

  setUser: (user) =>
    set({ user }),

  logout: () =>
    set({ user: null, token: null, isAuthenticated: false }),

  setLoading: (isLoading) =>
    set({ isLoading }),
}));
