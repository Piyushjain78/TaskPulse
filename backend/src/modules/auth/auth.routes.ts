import { Router } from "express";
import type { AuthService } from "./auth.service";
import { loginDto, refreshDto } from "./auth.dto";

export function createAuthRouter(authService: AuthService) {
  const r = Router();

  r.post("/login", async (req, res, next) => {
    try {
      const body = loginDto.parse(req.body);
      const result = await authService.login(body.email, body.password);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  r.post("/refresh", async (req, res, next) => {
    try {
      const body = refreshDto.parse(req.body);
      const result = await authService.refresh(body.refreshToken);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
