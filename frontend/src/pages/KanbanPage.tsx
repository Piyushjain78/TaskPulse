import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { KanbanBoard } from "../components/KanbanBoard";
import type { Task } from "../types";

export function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Task[]>("/api/tasks")
      .then(setTasks)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Kanban</h1>
      <p className="text-sm text-slate-500 mb-4">Tasks grouped by status.</p>
      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
      <KanbanBoard tasks={tasks} />
    </div>
  );
}
