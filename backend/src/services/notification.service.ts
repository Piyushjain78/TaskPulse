import type { Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { WhatsAppService, type TemplatePayload } from "../modules/whatsapp/whatsapp.service";

export type NotificationKind =
  | "TASK_ASSIGNED"
  | "TASK_PICKED_UP"
  | "TASK_COMPLETED"
  | "TASK_RETURNED"
  | "NEW_COMMENT";

/**
 * Central notification pipeline: persist → WebSocket → WhatsApp (when applicable).
 */
export class NotificationService {
  constructor(
    private io: Server,
    private whatsapp: WhatsAppService
  ) {}

  private room(userId: string) {
    return `user:${userId}`;
  }

  private async persistAndEmit(userId: string, message: string, taskId?: string) {
    const n = await prisma.notification.create({
      data: { userId, message, taskId: taskId ?? null },
    });
    this.io.to(this.room(userId)).emit("notification", {
      id: n.id,
      message: n.message,
      taskId: n.taskId,
      read: n.read,
      createdAt: n.createdAt,
    });
    return n;
  }

  async notifyTaskAssigned(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, creator: true },
    });
    if (!task) return;
    const message = `New task assigned: "${task.title}"`;
    await this.persistAndEmit(task.assignedTo, message, task.id);
    const payload: TemplatePayload = {
      taskTitle: task.title,
      assigneeName: task.assignee.name,
    };
    await this.whatsapp.sendTaskEvent(task.id, task.assignee.phone, "TASK_ASSIGNED", payload);
  }

  async notifyTaskPickedUp(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, creator: true },
    });
    if (!task) return;
    const message = `${task.assignee.name} started task "${task.title}"`;
    await this.persistAndEmit(task.createdBy, message, task.id);
  }

  async notifyTaskCompleted(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, creator: true },
    });
    if (!task) return;
    const message = `Task completed: "${task.title}" by ${task.assignee.name}`;
    await this.persistAndEmit(task.createdBy, message, task.id);
    const payload: TemplatePayload = {
      taskTitle: task.title,
      managerName: task.creator.name,
    };
    await this.whatsapp.sendTaskEvent(task.id, task.creator.phone, "TASK_COMPLETED", payload);
  }

  async notifyTaskReturned(taskId: string, commentPreview: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true },
    });
    if (!task) return;
    const message = `Task returned: "${task.title}" — ${commentPreview.slice(0, 120)}`;
    await this.persistAndEmit(task.assignedTo, message, task.id);
  }

  async listForUser(userId: string) {
    const items = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const unread = await prisma.notification.count({
      where: { userId, read: false },
    });
    return { items, unread };
  }

  async markRead(notificationId: string, userId: string) {
    const n = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return n.count > 0;
  }

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async notifyNewComment(taskId: string, authorId: string, preview: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, creator: true },
    });
    if (!task) return;
    const otherId = authorId === task.assignedTo ? task.createdBy : task.assignedTo;
    if (otherId === authorId) return;
    const message = `New comment on "${task.title}": ${preview.slice(0, 140)}`;
    await this.persistAndEmit(otherId, message, task.id);
  }
}
