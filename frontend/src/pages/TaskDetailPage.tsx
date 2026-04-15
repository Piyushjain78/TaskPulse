import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useAuthStore } from "../features/auth-store";
import type { CommentRow, Task } from "../types";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

export function TaskDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = async () => {
    if (!id) return;
    setErr(null);
    const t = await apiFetch<Task>(`/api/tasks/${id}`);
    setTask(t);
    const c = await apiFetch<CommentRow[]>(`/api/tasks/${id}/comments`);
    setComments(c);
  };

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  useEffect(() => {
    const iv = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const displaySeconds = useMemo(() => {
    if (!task) return 0;
    void tick;
    const base = task.totalWorkedSeconds ?? 0;
    if (task.timerRunState === "RUNNING" && task.activeSegmentStart) {
      return (
        base +
        Math.floor((Date.now() - new Date(task.activeSegmentStart).getTime()) / 1000)
      );
    }
    return base;
  }, [task, tick]);

  async function doTransition(
    action: "START" | "COMPLETE" | "APPROVE" | "RETURN",
    comment?: string
  ) {
    if (!id) return;
    setErr(null);
    try {
      await apiFetch(`/api/tasks/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action, comment }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function timer(action: "PAUSE" | "RESUME") {
    if (!id) return;
    setErr(null);
    try {
      await apiFetch(`/api/tasks/${id}/timer`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !msg.trim()) return;
    setErr(null);
    try {
      await apiFetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ message: msg.trim() }),
      });
      setMsg("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!task) {
    return <div className="text-slate-600">{err ?? "Loading…"}</div>;
  }

  const isAssignee = user?.role === "EMPLOYEE" && user.id === task.assignedTo;
  const isManager = user?.role === "MANAGER";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">{task.title}</h1>
      <p className="text-sm text-slate-500 mt-1">
        {task.assignee?.name} · {task.status.replace("_", " ")}
      </p>
      {task.description && <p className="mt-4 text-slate-700 whitespace-pre-wrap">{task.description}</p>}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Due</div>
          <div className="font-medium">
            {task.dueDate ? new Date(task.dueDate).toLocaleString() : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Tracked time</div>
          <div className="font-mono text-lg">{formatDuration(displaySeconds)}</div>
          <div className="text-xs text-slate-500 mt-1">State: {task.timerRunState}</div>
        </div>
      </div>

      {err && <div className="mt-4 text-sm text-red-600">{err}</div>}

      <div className="mt-6 flex flex-wrap gap-2">
        {isAssignee && (task.status === "PENDING" || task.status === "RETURNED") && (
          <button
            type="button"
            className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm"
            onClick={() => doTransition("START")}
          >
            Start task
          </button>
        )}
        {isAssignee && task.status === "IN_PROGRESS" && (
          <>
            {task.timerRunState === "RUNNING" && (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => timer("PAUSE")}
              >
                Pause timer
              </button>
            )}
            {task.timerRunState === "PAUSED" && (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => timer("RESUME")}
              >
                Resume timer
              </button>
            )}
            <button
              type="button"
              className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm"
              onClick={() => doTransition("COMPLETE")}
            >
              Mark complete
            </button>
          </>
        )}
        {isManager && task.status === "COMPLETED" && (
          <>
            <button
              type="button"
              className="rounded-md bg-emerald-700 text-white px-3 py-1.5 text-sm"
              onClick={() => doTransition("APPROVE")}
            >
              Approve
            </button>
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <textarea
                className="rounded border border-slate-300 text-sm px-2 py-1 min-w-[240px]"
                placeholder="Required comment to return"
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                rows={2}
              />
              <button
                type="button"
                className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-sm self-start"
                onClick={() => doTransition("RETURN", returnComment)}
              >
                Return
              </button>
            </div>
          </>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Comments</h2>
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg border border-slate-200 bg-white p-3 text-sm ${
                c.parentId ? "ml-6 border-l-4 border-l-brand-200" : ""
              }`}
            >
              <div className="text-xs text-slate-500">
                {c.user.name} · {c.user.role} · {new Date(c.createdAt).toLocaleString()}
                {c.parentId && <span className="ml-2 text-brand-600">(reply)</span>}
              </div>
              <div className="mt-1 text-slate-800 whitespace-pre-wrap">{c.message}</div>
            </li>
          ))}
        </ul>
        <form className="mt-4 flex flex-col gap-2" onSubmit={sendComment}>
          <textarea
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="Write a comment…"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <button
            type="submit"
            className="self-start rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm"
          >
            Post comment
          </button>
        </form>
      </section>
    </div>
  );
}
