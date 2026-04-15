import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import type { TaskPriority } from "../types";

type Emp = { id: string; name: string; email: string };

export function CreateTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Emp[]>("/api/users/employees")
      .then((list) => {
        setEmployees(list);
        if (list[0]) setAssigneeId(list[0].id);
      })
      .catch(() => setErr("Could not load employees"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          assigneeId,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          priority,
        }),
      });
      onCreated();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold">Create task</h2>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div>
            <label className="text-xs text-slate-600">Title</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Description</label>
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Assignee (employees)</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              required
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600">Due date</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Priority</label>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-1.5 text-sm text-slate-600" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !assigneeId}
              className="rounded-md bg-brand-600 text-white px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
