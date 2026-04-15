import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth-store";
import { NotificationBell } from "./NotificationBell";
import { disconnectSocket } from "../services/socket";

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold text-brand-600">
              TaskPulse
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link className="text-slate-600 hover:text-slate-900" to="/">
                Table
              </Link>
              <Link className="text-slate-600 hover:text-slate-900" to="/kanban">
                Kanban
              </Link>
              {user?.role === "EMPLOYEE" && (
                <Link className="text-slate-600 hover:text-slate-900" to="/my-tasks">
                  My Tasks
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-sm text-slate-500 hidden sm:inline">{user?.name}</span>
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={() => {
                disconnectSocket();
                logout();
                nav("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
