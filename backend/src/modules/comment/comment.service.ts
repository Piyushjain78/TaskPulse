import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import type { JwtPayload } from "../../middleware/auth";
import type { NotificationService } from "../../services/notification.service";

export class CommentService {
  constructor(private notifications: NotificationService) {}

  private async assertTaskAccess(taskId: string, user: JwtPayload) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true },
    });
    if (!task) throw new HttpError(404, "Task not found");
    if (user.role === Role.EMPLOYEE) {
      if (task.assignedTo !== user.sub) throw new HttpError(403, "Forbidden");
      return task;
    }
    const ok = task.createdBy === user.sub || task.assignee.managerId === user.sub;
    if (!ok) throw new HttpError(403, "Forbidden");
    return task;
  }

  async list(taskId: string, user: JwtPayload) {
    await this.assertTaskAccess(taskId, user);
    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async create(
    taskId: string,
    user: JwtPayload,
    data: { message: string; parentId?: string }
  ) {
    await this.assertTaskAccess(taskId, user);
    if (data.parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: data.parentId, taskId },
      });
      if (!parent) throw new HttpError(400, "Invalid parent comment");
    }
    const c = await prisma.comment.create({
      data: {
        taskId,
        userId: user.sub,
        message: data.message,
        parentId: data.parentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    await this.notifications.notifyNewComment(taskId, user.sub, data.message);
    return c;
  }
}
