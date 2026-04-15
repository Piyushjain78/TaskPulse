import { z } from "zod";

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginDto>;
export type RefreshInput = z.infer<typeof refreshDto>;
