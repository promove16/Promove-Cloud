import { existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const envPathCandidates = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];

const envPath = envPathCandidates.find((candidate) => existsSync(candidate));

dotenv.config(envPath ? { path: envPath } : undefined);

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  UPSTASH_REDIS_HOST: z.string().min(1),
  UPSTASH_REDIS_PASSWORD: z.string().min(1).optional(),
  REDIS_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  REDIS_REQUEST_RETRIES: z.coerce.number().int().min(0).default(0),
  AUTH_ALLOW_REDIS_AUTH_FALLBACK: booleanFromEnv.optional(),
  BULLMQ_USE_REDIS: booleanFromEnv.optional(),
  BULLMQ_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BULLMQ_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES: z.string().min(1).default("30d"),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  RATE_LIMIT_ENABLED: booleanFromEnv.default(true),
  CLIENT_URL: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  EMAIL_USER: z.string().min(1).optional(),
  EMAIL_PASS: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  FROM_EMAIL: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(missing)}`);
}

const normalizeMultiline = (value: string) => value.replace(/\\n/g, "\n");

export const env = {
  ...parsed.data,
  JWT_ACCESS_SECRET: normalizeMultiline(parsed.data.JWT_ACCESS_SECRET),
  JWT_REFRESH_SECRET: normalizeMultiline(parsed.data.JWT_REFRESH_SECRET),
  AUTH_ALLOW_REDIS_AUTH_FALLBACK:
    parsed.data.AUTH_ALLOW_REDIS_AUTH_FALLBACK ?? parsed.data.NODE_ENV !== "production",
  BULLMQ_USE_REDIS:
    parsed.data.BULLMQ_USE_REDIS ?? parsed.data.NODE_ENV === "production",
};
