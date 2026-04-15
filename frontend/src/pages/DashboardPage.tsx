import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { TaskTable } from "../components/TaskTable";
import type { Task, TaskPriority, TaskStatus } from "../types";
import { useAuthStore } from "../features/auth-store";
import { CreateTaskModal } from "../components/CreateTaskModal";

export function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    const q = params.toString();
    const data = await apiFetch<Task[]>(`/api/tasks${q ? `?${q}` : ""}`);
    setTasks(data);
  }, [status, priority, sortBy, sortDir]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  function onSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">Sortable table with status and priority filters.</p>
        </div>
        {role === "MANAGER" && (
          <button
            type="button"
            onClick={() => setModal(true)}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-500"
          >
            Create task
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500">Status</label>
          <select
            className="mt-1 rounded-md border border-slate-300 text-sm px-2 py-1.5"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="APPROVED">Approved</option>
            <option value="RETURNED">Returned</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Priority</label>
          <select
            className="mt-1 rounded-md border border-slate-300 text-sm px-2 py-1.5"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority | "")}
          >
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>
      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
      <TaskTable
        tasks={tasks}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        highlightOverdue={role === "EMPLOYEE"}
      />
      {modal && <CreateTaskModal onClose={() => setModal(false)} onCreated={() => load()} />}
    </div>
  );
}
