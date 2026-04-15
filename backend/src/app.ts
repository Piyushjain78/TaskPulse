import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { Env } from "./config/env";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import type { AuthService } from "./modules/auth/auth.service";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createTaskRouter } from "./modules/task/task.routes";
import { createUserRouter } from "./modules/user/user.routes";
import { createNotificationRouter } from "./modules/notification/notification.routes";
import type { TaskService } from "./modules/task/task.service";
import type { UserService } from "./modules/user/user.service";
import type { CommentService } from "./modules/comment/comment.service";
import type { NotificationService } from "./services/notification.service";

export function createApp(
  env: Env,
  deps: {
    authService: AuthService;
    taskService: TaskService;
    userService: UserService;
    commentService: CommentService;
    notificationService: NotificationService;
  }
) {
  const app = express();
  app.use(
    cors({
      origin: env.CORS_ORIGIN?.split(",") ?? true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", createAuthRouter(deps.authService));

  const auth = authMiddleware(env);
  app.use("/api/tasks", auth, createTaskRouter(deps.taskService, deps.commentService));
  app.use("/api/users", auth, createUserRouter(deps.userService));
  app.use("/api/notifications", auth, createNotificationRouter(deps.notificationService));

  app.use(errorHandler);
  return app;
}
