import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  LINKEDIN_OAUTH_REDIRECT_URI: z.string().url().optional(),
  MAX_USERS_YEAR_ONE: z.coerce.number().int().positive().default(2000),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
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
};
