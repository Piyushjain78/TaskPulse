import { Link } from "react-router-dom";
import type { Task, TaskStatus } from "../types";

const columns: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
  "RETURNED",
];

const labels: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const grouped = columns.map((c) => ({
    status: c,
    items: tasks.filter((t) => t.status === c),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {grouped.map((col) => (
        <div key={col.status} className="rounded-lg border border-slate-200 bg-slate-50/80 min-h-[200px] flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 text-sm font-semibold text-slate-700">
            {labels[col.status]}
            <span className="ml-2 text-slate-400 font-normal">({col.items.length})</span>
          </div>
          <div className="p-2 flex flex-col gap-2 flex-1">
            {col.items.map((t) => (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                className="block rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm hover:border-brand-300"
              >
                <div className="font-medium text-slate-900 line-clamp-2">{t.title}</div>
                <div className="text-xs text-slate-500 mt-1">{t.assignee?.name}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
