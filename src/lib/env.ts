import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  SALON_PIN_HASH: z.string().length(64),
  SALON_SESSION_SECRET: z.string().min(32),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  SALON_PIN_HASH: process.env.SALON_PIN_HASH,
  SALON_SESSION_SECRET: process.env.SALON_SESSION_SECRET,
});
