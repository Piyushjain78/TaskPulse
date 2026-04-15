import {
  Role,
  TaskPriority,
  TaskStatus,
  TimerRunState,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import type { JwtPayload } from "../../middleware/auth";
import type { NotificationService } from "../../services/notification.service";

export class TaskService {
  constructor(private notifications: NotificationService) {}

  private managerFilter(managerId: string): Prisma.TaskWhereInput {
    return {
      OR: [{ createdBy: managerId }, { assignee: { managerId } }],
    };
  }

  private async ensureAccess(taskId: string, user: JwtPayload) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, creator: true },
    });
    if (!task) throw new HttpError(404, "Task not found");
    if (user.role === Role.EMPLOYEE) {
      if (task.assignedTo !== user.sub) throw new HttpError(403, "Forbidden");
      return task;
    }
    const ok =
      task.createdBy === user.sub || task.assignee.managerId === user.sub;
    if (!ok) throw new HttpError(403, "Forbidden");
    return task;
  }

  async list(user: JwtPayload, query: {
    status?: TaskStatus;
    priority?: TaskPriority;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }) {
    const where: Prisma.TaskWhereInput =
      user.role === Role.MANAGER
        ? this.managerFilter(user.sub)
        : { assignedTo: user.sub };

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const sortField = query.sortBy ?? "createdAt";
    const dir = query.sortDir ?? "desc";
    let orderBy: Prisma.TaskOrderByWithRelationInput;
    if (sortField === "assignee") {
      orderBy = { assignee: { name: dir } };
    } else {
      orderBy = { [sortField]: dir } as Prisma.TaskOrderByWithRelationInput;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    const withMeta = await Promise.all(
      tasks.map(async (t) => ({
        ...t,
        totalWorkedSeconds: await this.computeWorkedSeconds(t.id),
        activeElapsedSeconds: await this.computeActiveElapsed(t),
      }))
    );
    return withMeta;
  }

  async getById(taskId: string, user: JwtPayload) {
    const task = await this.ensureAccess(taskId, user);
    await this.reconcileTimerState(task.id);
    const totalWorkedSeconds = await this.computeWorkedSeconds(task.id);
    const activeElapsedSeconds = await this.computeActiveElapsed(
      await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    );
    const full = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true, email: true, role: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
        timeLogs: { orderBy: { startTime: "asc" } },
      },
    });
    return { ...full, totalWorkedSeconds, activeElapsedSeconds };
  }

  async create(
    creator: JwtPayload,
    data: {
      title: string;
      description?: string;
      assigneeId: string;
      dueDate?: Date;
      priority: TaskPriority;
    }
  ) {
    if (creator.role !== Role.MANAGER) {
      throw new HttpError(403, "Only managers can create tasks");
    }
    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId } });
    if (!assignee || assignee.role !== Role.EMPLOYEE) {
      throw new HttpError(400, "Assignee must be an employee");
    }
    if (assignee.managerId !== creator.sub) {
      throw new HttpError(400, "Assignee must report to you");
    }
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: TaskStatus.PENDING,
        priority: data.priority,
        dueDate: data.dueDate,
        assignedTo: data.assigneeId,
        createdBy: creator.sub,
        timerRunState: TimerRunState.STOPPED,
      },
    });
    await this.notifications.notifyTaskAssigned(task.id);
    return task;
  }

  async transition(
    taskId: string,
    user: JwtPayload,
    action: "START" | "COMPLETE" | "APPROVE" | "RETURN",
    comment?: string
  ) {
    const task = await this.ensureAccess(taskId, user);
    await this.reconcileTimerState(task.id);

    if (action === "START") {
      if (user.role !== Role.EMPLOYEE || task.assignedTo !== user.sub) {
        throw new HttpError(403, "Only the assignee can start this task");
      }
      if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RETURNED) {
        throw new HttpError(400, "Invalid transition for START");
      }
      const wasPickedFromPending = task.status === TaskStatus.PENDING;
      const updated = await prisma.$transaction(async (tx) => {
        const open = await tx.timeLog.findFirst({
          where: { taskId, endTime: null },
        });
        if (open) {
          return tx.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.IN_PROGRESS,
              timerRunState: TimerRunState.RUNNING,
              activeSegmentStart: open.startTime,
            },
          });
        }
        const now = new Date();
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.IN_PROGRESS,
            timerRunState: TimerRunState.RUNNING,
            activeSegmentStart: now,
          },
        });
        await tx.timeLog.create({
          data: { taskId, startTime: now, endTime: null },
        });
        return tx.task.findUniqueOrThrow({ where: { id: taskId } });
      });
      if (wasPickedFromPending) {
        await this.notifications.notifyTaskPickedUp(taskId);
      }
      return updated;
    }

    if (action === "COMPLETE") {
      if (user.role !== Role.EMPLOYEE || task.assignedTo !== user.sub) {
        throw new HttpError(403, "Only the assignee can complete this task");
      }
      if (task.status !== TaskStatus.IN_PROGRESS) {
        throw new HttpError(400, "Invalid transition for COMPLETE");
      }
      await this.closeOpenSegment(taskId);
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          timerRunState: TimerRunState.STOPPED,
          activeSegmentStart: null,
        },
      });
      await this.notifications.notifyTaskCompleted(taskId);
      return updated;
    }

    if (action === "APPROVE") {
      if (user.role !== Role.MANAGER) throw new HttpError(403, "Managers only");
      if (task.createdBy !== user.sub && task.assignee.managerId !== user.sub) {
        throw new HttpError(403, "Forbidden");
      }
      if (task.status !== TaskStatus.COMPLETED) {
        throw new HttpError(400, "Invalid transition for APPROVE");
      }
      return prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.APPROVED },
      });
    }

    if (action === "RETURN") {
      if (user.role !== Role.MANAGER) throw new HttpError(403, "Managers only");
      if (task.createdBy !== user.sub && task.assignee.managerId !== user.sub) {
        throw new HttpError(403, "Forbidden");
      }
      if (task.status !== TaskStatus.COMPLETED) {
        throw new HttpError(400, "Invalid transition for RETURN");
      }
      if (!comment?.trim()) {
        throw new HttpError(400, "Comment is required when returning a task");
      }
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.RETURNED, timerRunState: TimerRunState.STOPPED, activeSegmentStart: null },
        });
        await tx.comment.create({
          data: {
            taskId,
            userId: user.sub,
            message: `[Return] ${comment.trim()}`,
          },
        });
        return u;
      });
      await this.notifications.notifyTaskReturned(taskId, comment.trim());
      return updated;
    }

    throw new HttpError(400, "Unsupported action");
  }

  async timerControl(
    taskId: string,
    user: JwtPayload,
    action: "PAUSE" | "RESUME"
  ) {
    const task = await this.ensureAccess(taskId, user);
    if (user.role !== Role.EMPLOYEE || task.assignedTo !== user.sub) {
      throw new HttpError(403, "Only the assignee can control the timer");
    }
    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new HttpError(400, "Timer only while task is in progress");
    }
    await this.reconcileTimerState(task.id);

    if (action === "PAUSE") {
      if (task.timerRunState !== TimerRunState.RUNNING) {
        return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
      }
      const now = new Date();
      await prisma.$transaction([
        prisma.timeLog.updateMany({
          where: { taskId, endTime: null },
          data: { endTime: now },
        }),
        prisma.task.update({
          where: { id: taskId },
          data: { timerRunState: TimerRunState.PAUSED, activeSegmentStart: null },
        }),
      ]);
      return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    }

    if (task.timerRunState !== TimerRunState.PAUSED) {
      return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.timeLog.create({
        data: { taskId, startTime: now, endTime: null },
      }),
      prisma.task.update({
        where: { id: taskId },
        data: { timerRunState: TimerRunState.RUNNING, activeSegmentStart: now },
      }),
    ]);
    return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  }

  private async closeOpenSegment(taskId: string) {
    const now = new Date();
    await prisma.timeLog.updateMany({
      where: { taskId, endTime: null },
      data: { endTime: now },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { activeSegmentStart: null, timerRunState: TimerRunState.STOPPED },
    });
  }

  /** Collapses duplicate open segments (e.g. multiple tabs) to a single active segment. */
  private async reconcileTimerState(taskId: string) {
    const open = await prisma.timeLog.findMany({ where: { taskId, endTime: null } });
    if (open.length <= 1) return;
    const sorted = [...open].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const keep = sorted[sorted.length - 1];
    for (const seg of sorted.slice(0, -1)) {
      await prisma.timeLog.update({
        where: { id: seg.id },
        data: { endTime: seg.startTime },
      });
    }
    await prisma.task.update({
      where: { id: taskId },
      data: { activeSegmentStart: keep.startTime, timerRunState: TimerRunState.RUNNING },
    });
  }

  /** Sum of completed segments only (closed `TimeLog` rows). */
  private async computeWorkedSeconds(taskId: string): Promise<number> {
    const logs = await prisma.timeLog.findMany({
      where: { taskId, endTime: { not: null } },
    });
    let sec = 0;
    for (const l of logs) {
      if (!l.endTime) continue;
      sec += Math.max(0, (l.endTime.getTime() - l.startTime.getTime()) / 1000);
    }
    return Math.floor(sec);
  }

  /** Elapsed time for the currently running open segment (if any). */
  private async computeActiveElapsed(task: {
    id: string;
    timerRunState: TimerRunState;
    activeSegmentStart: Date | null;
  }): Promise<number> {
    if (task.timerRunState !== TimerRunState.RUNNING || !task.activeSegmentStart) return 0;
    return Math.floor((Date.now() - task.activeSegmentStart.getTime()) / 1000);
  }
}
