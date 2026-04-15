import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../features/auth-store";
import { useNotificationStore } from "../features/notification-store";
import type { NotificationRow } from "../types";

const wsUrl = () => import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || "";

let socket: Socket | null = null;

export function connectSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;
  if (socket?.connected) return;
  socket = io(wsUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
  });
  socket.on("notification", (payload: NotificationRow) => {
    useNotificationStore.getState().push(payload);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function reconnectSocket() {
  disconnectSocket();
  connectSocket();
}
