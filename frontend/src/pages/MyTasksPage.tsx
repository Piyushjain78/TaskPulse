import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { TaskTable } from "../components/TaskTable";
import type { Task } from "../types";

export function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sortBy, setSortBy] = useState("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    const data = await apiFetch<Task[]>(`/api/tasks?${params.toString()}`);
    setTasks(data);
  }, [sortBy, sortDir]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
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
      <h1 className="text-xl font-semibold text-slate-900 mb-1">My Tasks</h1>
      <p className="text-sm text-slate-500 mb-4">
        Assigned to you. Overdue items are highlighted when not finished.
      </p>
      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
      <TaskTable tasks={tasks} sortBy={sortBy} sortDir={sortDir} onSort={onSort} highlightOverdue />
    </div>
  );
}
