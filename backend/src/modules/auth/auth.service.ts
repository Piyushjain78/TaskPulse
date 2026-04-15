import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import type { JwtPayload } from "../../middleware/auth";
import type { User } from "@prisma/client";

export class AuthService {
  constructor(private env: Env) {}

  private signOpts(expiresIn: string): SignOptions {
    return { expiresIn } as SignOptions;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new HttpError(401, "Invalid credentials");
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new HttpError(401, "Invalid credentials");

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.env.JWT_ACCESS_SECRET, this.signOpts(this.env.JWT_ACCESS_EXPIRES));
    const refreshToken = jwt.sign(
      { sub: user.id },
      this.env.JWT_REFRESH_SECRET,
      this.signOpts(this.env.JWT_REFRESH_EXPIRES)
    );

    return {
      user: this.sanitize(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    let sub: string;
    try {
      const decoded = jwt.verify(refreshToken, this.env.JWT_REFRESH_SECRET) as { sub: string };
      sub = decoded.sub;
    } catch {
      throw new HttpError(401, "Invalid refresh token");
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) throw new HttpError(401, "User not found");

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = jwt.sign(payload, this.env.JWT_ACCESS_SECRET, this.signOpts(this.env.JWT_ACCESS_EXPIRES));
    const newRefresh = jwt.sign(
      { sub: user.id },
      this.env.JWT_REFRESH_SECRET,
      this.signOpts(this.env.JWT_REFRESH_EXPIRES)
    );
    return { accessToken, refreshToken: newRefresh, user: this.sanitize(user) };
  }

  private sanitize(user: User) {
    const { password: _p, ...rest } = user;
    return rest;
  }
}
