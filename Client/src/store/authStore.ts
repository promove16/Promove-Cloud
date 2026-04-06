import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AuthUser } from "../types/auth.types";
import { UserRole } from "../types/roles.types";

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

const normalizeUser = (user: AuthUser): AuthUser => ({
  ...user,
  role:
    (user.role as unknown as string) === "company"
      ? UserRole.RECRUITER
      : user.role,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (user, token) =>
        set({
          user: normalizeUser(user),
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
        }),
      setUser: (user) =>
        set((state) => ({
          user: normalizeUser(user),
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
      name: "promove-auth-user",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState> | undefined;
        return {
          ...currentState,
          user: persisted?.user ? normalizeUser(persisted.user) : null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: true,
        };
      },
    },
  ),
);
