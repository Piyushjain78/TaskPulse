import { Link } from "react-router-dom";
import clsx from "clsx";
import type { Task, TaskPriority, TaskStatus } from "../types";

const statusLabels: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function formatDuration(sec?: number) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

type Props = {
  tasks: Task[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  highlightOverdue?: boolean;
};

export function TaskTable({ tasks, sortBy, sortDir, onSort, highlightOverdue }: Props) {
  const header = (id: string, label: string) => (
    <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
      <button type="button" className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => onSort(id)}>
        {label}
        {sortBy === id && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {header("title", "Title")}
            {header("status", "Status")}
            {header("priority", "Priority")}
            {header("dueDate", "Due")}
            {header("assignee", "Assignee")}
            <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Time</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const overdue =
              highlightOverdue &&
              t.dueDate &&
              new Date(t.dueDate) < new Date() &&
              t.status !== "APPROVED" &&
              t.status !== "COMPLETED";
            const total = (t.totalWorkedSeconds ?? 0) + (t.activeElapsedSeconds ?? 0);
            return (
              <tr
                key={t.id}
                className={clsx(
                  "border-b border-slate-100 last:border-0 hover:bg-slate-50/80",
                  overdue && "bg-amber-50"
                )}
              >
                <td className="p-2">
                  <Link className="text-brand-600 hover:underline font-medium" to={`/tasks/${t.id}`}>
                    {t.title}
                  </Link>
                </td>
                <td className="p-2">{statusLabels[t.status]}</td>
                <td className="p-2">{priorityLabels[t.priority]}</td>
                <td className="p-2 whitespace-nowrap">
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                </td>
                <td className="p-2">{t.assignee?.name ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{formatDuration(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
