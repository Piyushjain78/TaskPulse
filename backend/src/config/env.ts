import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  CORS_ORIGIN: z.string().optional(),
  WHATSAPP_PROVIDER: z.enum(["msg91", "gupshup", "none"]).default("none"),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_WHATSAPP_INTEGRATED_NUMBER: z.string().optional(),
  MSG91_TEMPLATE_NAMESPACE: z.string().optional(),
  MSG91_TEMPLATE_TASK_ASSIGNED: z.string().optional(),
  MSG91_TEMPLATE_TASK_COMPLETED: z.string().optional(),
  GUPSHUP_USER_ID: z.string().optional(),
  GUPSHUP_PASSWORD: z.string().optional(),
  GUPSHUP_APP_NAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}
