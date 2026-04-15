import { create } from "zustand";
import type { User } from "../types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (accessToken: string, refreshToken: string, user: User) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
};

const STORAGE_KEY = "taskpulse_auth";

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setSession: (accessToken, refreshToken, user) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, user }));
    set({ accessToken, refreshToken, user });
  },
  updateTokens: (accessToken, refreshToken) => {
    const u = get().user;
    if (!u) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, user: u }));
    set({ accessToken, refreshToken });
  },
  logout: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
  hydrate: () => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const { accessToken, refreshToken, user } = JSON.parse(raw) as {
        accessToken: string;
        refreshToken: string;
        user: User;
      };
      set({ accessToken, refreshToken, user });
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  },
}));
