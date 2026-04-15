import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";

export const createTaskDto = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  assigneeId: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
  priority: z.nativeEnum(TaskPriority),
});

export const listTasksQuery = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  sortBy: z.enum(["dueDate", "priority", "status", "createdAt", "title", "assignee"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const transitionDto = z.object({
  action: z.enum(["START", "COMPLETE", "APPROVE", "RETURN"]),
  comment: z.string().max(5000).optional(),
});

export const timerActionDto = z.object({
  action: z.enum(["PAUSE", "RESUME"]),
});

export type CreateTaskInput = z.infer<typeof createTaskDto>;
export type ListTasksQuery = z.infer<typeof listTasksQuery>;
