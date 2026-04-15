import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { loadEnv } from "./config/env";
import { createApp } from "./app";
import { AuthService } from "./modules/auth/auth.service";
import { TaskService } from "./modules/task/task.service";
import { UserService } from "./modules/user/user.service";
import { CommentService } from "./modules/comment/comment.service";
import { WhatsAppService } from "./modules/whatsapp/whatsapp.service";
import { NotificationService } from "./services/notification.service";
import type { JwtPayload } from "./middleware/auth";

const env = loadEnv();
const whatsapp = new WhatsAppService(env);

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  },
});

const notificationService = new NotificationService(io, whatsapp);
const taskService = new TaskService(notificationService);
const commentService = new CommentService(notificationService);
const authService = new AuthService(env);
const userService = new UserService();

const app = createApp(env, {
  authService,
  taskService,
  userService,
  commentService,
  notificationService,
});

httpServer.on("request", app);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Unauthorized"));
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const uid = socket.data.userId as string;
  socket.join(`user:${uid}`);
});

const port = env.PORT;
httpServer.listen(port, () => {
  console.log(`TaskPulse API listening on :${port}`);
});
