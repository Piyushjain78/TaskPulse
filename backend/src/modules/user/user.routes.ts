import { Router } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../../lib/http-error";
import { requireRole } from "../../middleware/auth";
import type { UserService } from "./user.service";

export function createUserRouter(userService: UserService) {
  const r = Router();

  r.get("/employees", requireRole(Role.MANAGER), async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const users = await userService.listEmployeesForManager(req.user);
      res.json(users);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
