import { create } from "zustand";
import type { NotificationRow } from "../types";

type NState = {
  items: NotificationRow[];
  unread: number;
  setFromApi: (items: NotificationRow[], unread: number) => void;
  push: (n: NotificationRow) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

export const useNotificationStore = create<NState>((set) => ({
  items: [],
  unread: 0,
  setFromApi: (items, unread) => set({ items, unread }),
  push: (n) =>
    set((s) => ({
      items: [n, ...s.items].slice(0, 100),
      unread: n.read ? s.unread : s.unread + 1,
    })),
  markRead: (id) =>
    set((s) => {
      const items = s.items.map((x) => (x.id === id ? { ...x, read: true } : x));
      const unread = items.filter((x) => !x.read).length;
      return { items, unread };
    }),
  markAllRead: () =>
    set((s) => ({
      items: s.items.map((x) => ({ ...x, read: true })),
      unread: 0,
    })),
}));
