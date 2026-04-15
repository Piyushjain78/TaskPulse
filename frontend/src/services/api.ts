import { useAuthStore } from "../features/auth-store";
import { reconnectSocket } from "./socket";

const base = () => import.meta.env.VITE_API_URL || "";

async function refreshTokens(): Promise<string | null> {
  const refresh = useAuthStore.getState().refreshToken;
  if (!refresh) return null;
  const res = await fetch(`${base()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  useAuthStore.getState().updateTokens(data.accessToken, data.refreshToken);
  reconnectSocket();
  return data.accessToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${base()}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    const newTok = await refreshTokens();
    if (newTok) {
      return apiFetch<T>(path, init, false);
    }
    useAuthStore.getState().logout();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
