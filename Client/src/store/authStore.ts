import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthUser } from '../types/auth.types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (user, token) =>
        set({
          user,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
        }),
      setUser: (user) =>
        set((state) => ({
          user,
          accessToken: state.accessToken,
          isAuthenticated: state.isAuthenticated,
          isLoading: state.isLoading,
        })),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),
      setLoading: (value) => set({ isLoading: value }),
    }),
    {
      name: 'promove-auth-user',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState> | undefined;
        return {
          ...currentState,
          user: persisted?.user ?? null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: true,
        };
      },
    },
  ),
);
