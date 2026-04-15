import { Router } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../../lib/http-error";
import { requireRole } from "../../middleware/auth";
import type { TaskService } from "./task.service";
import { createTaskDto, listTasksQuery, transitionDto, timerActionDto } from "./task.dto";
import type { CommentService } from "../comment/comment.service";
import { createCommentDto } from "../comment/comment.dto";

export function createTaskRouter(taskService: TaskService, commentService: CommentService) {
  const r = Router();

  r.get("/", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const q = listTasksQuery.parse(req.query);
      const tasks = await taskService.list(req.user, q);
      res.json(tasks);
    } catch (e) {
      next(e);
    }
  });

  r.post("/", requireRole(Role.MANAGER), async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const body = createTaskDto.parse(req.body);
      const task = await taskService.create(req.user, {
        title: body.title,
        description: body.description,
        assigneeId: body.assigneeId,
        dueDate: body.dueDate,
        priority: body.priority,
      });
      res.status(201).json(task);
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/transition", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const body = transitionDto.parse(req.body);
      const updated = await taskService.transition(req.params.id, req.user, body.action, body.comment);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/timer", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const body = timerActionDto.parse(req.body);
      const updated = await taskService.timerControl(req.params.id, req.user, body.action);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id/comments", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const comments = await commentService.list(req.params.id, req.user);
      res.json(comments);
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/comments", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const body = createCommentDto.parse(req.body);
      const c = await commentService.create(req.params.id, req.user, body);
      res.status(201).json(c);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const task = await taskService.getById(req.params.id, req.user);
      res.json(task);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
