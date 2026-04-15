import { Router } from "express";
import { HttpError } from "../../lib/http-error";
import type { NotificationService } from "../../services/notification.service";

export function createNotificationRouter(notificationService: NotificationService) {
  const r = Router();

  r.get("/", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const data = await notificationService.listForUser(req.user.sub);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  r.patch("/:id/read", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const ok = await notificationService.markRead(req.params.id, req.user.sub);
      if (!ok) throw new HttpError(404, "Not found");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/read-all", async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      await notificationService.markAllRead(req.user.sub);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
