import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useNotificationStore } from "../features/notification-store";
import type { NotificationRow } from "../types";

export function NotificationBell() {
  const { items, unread, setFromApi, markRead, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    apiFetch<{ items: NotificationRow[]; unread: number }>("/api/notifications")
      .then((d) => setFromApi(d.items, d.unread))
      .catch(() => {});
  }, [setFromApi]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative rounded-full p-2 hover:bg-slate-100 text-slate-700"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[1.1rem] text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline"
              onClick={() => {
                apiFetch("/api/notifications/read-all", { method: "POST" }).then(() => markAllRead());
              }}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                      n.read ? "text-slate-600" : "text-slate-900 font-medium"
                    }`}
                    onClick={() => {
                      if (!n.read) {
                        apiFetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).then(() =>
                          markRead(n.id)
                        );
                      }
                      setOpen(false);
                      if (n.taskId) nav(`/tasks/${n.taskId}`);
                    }}
                  >
                    <div>{n.message}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
