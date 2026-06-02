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

const commaSeparatedListFromEnv = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}, z.array(z.string().min(1)));

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  AWS_REDIS_HOST: z.string().min(1).optional(),
  AWS_REDIS_PORT: z.coerce.number().int().positive().default(6379),
  AWS_REDIS_TLS: booleanFromEnv.default(true),
  AWS_REDIS_AUTH_TOKEN: z.string().min(1).optional(),
  UPSTASH_REDIS_HOST: z.string().min(1).optional(),
  UPSTASH_REDIS_PORT: z.coerce.number().int().positive().default(6379),
  UPSTASH_REDIS_TLS: booleanFromEnv.default(true),
  UPSTASH_REDIS_PASSWORD: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
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
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  RATE_LIMIT_ENABLED: booleanFromEnv.default(true),
  CLIENT_URL: z.string().min(1),
  ALLOWED_ORIGINS: commaSeparatedListFromEnv.default([]),
  SUPPORT_EMAIL: z.string().email().default("charan.f.sde@gmail.com"),
  DNS_RESOLVERS: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_SESSION_TOKEN: z.string().min(1).optional(),
  AWS_S3_BUCKET_NAME: z.string().min(1).optional(),
  AWS_S3_PUBLIC_BASE_URL: z.string().url().optional(),
  EMAIL_USER: z.string().min(1).optional(),
  EMAIL_PASS: z.string().min(1).optional(),
  MAIL_TRANSPORT: z.enum(["auto", "smtp", "ses", "json"]).default("auto"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  FROM_EMAIL: z.string().min(1),
  DEV_EMAIL_REDIRECT: z.string().email().optional(),
  MONGO_EXCEL_BACKUP_ENABLED: booleanFromEnv.default(false),
  MONGO_EXCEL_BACKUP_RUN_ON_START: booleanFromEnv.default(true),
  MONGO_EXCEL_BACKUP_CRON: z.string().min(1).default("0 2 * * *"),
  MONGO_EXCEL_BACKUP_TIMEZONE: z.string().min(1).default("UTC"),
  MONGO_EXCEL_BACKUP_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  MONGO_EXCEL_BACKUP_S3_PREFIX: z.string().min(1).default("backups/mongo-excel"),
  MONGO_EXCEL_BACKUP_MAX_DOCS_PER_COLLECTION: z.coerce
    .number()
    .int()
    .positive()
    .default(50000),
  MONGO_EXCEL_BACKUP_SAMPLE_SIZE: z.coerce.number().int().positive().default(100),
  MONGO_EXCEL_BACKUP_COLLECTIONS: z.string().min(1).optional(),
  MONGO_DISASTER_BACKUP_ENABLED: booleanFromEnv.default(false),
  MONGO_DISASTER_BACKUP_S3_PREFIX: z.string().min(1).default("backups/mongo-archive"),
  MONGODUMP_BIN: z.string().min(1).default("mongodump"),
  // Pure-Node restorable backup (no mongodump binary required).
  MONGO_NATIVE_BACKUP_ENABLED: booleanFromEnv.default(false),
  MONGO_NATIVE_BACKUP_S3_PREFIX: z.string().min(1).default("backups/mongo-native"),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
  GROQ_BASE_URL: z
    .string()
    .url()
    .default("https://api.groq.com/openai/v1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(missing)}`);
}

const resolvedBullMqUseRedis =
  parsed.data.BULLMQ_USE_REDIS ?? parsed.data.NODE_ENV === "production";

const hasRedisConnection =
  Boolean(parsed.data.REDIS_URL) ||
  Boolean(parsed.data.UPSTASH_REDIS_HOST) ||
  Boolean(parsed.data.AWS_REDIS_HOST);

if (resolvedBullMqUseRedis && !hasRedisConnection) {
  throw new Error(
    "Invalid environment variables: BULLMQ_USE_REDIS=true requires REDIS_URL, UPSTASH_REDIS_HOST, or AWS_REDIS_HOST.",
  );
}

if (
  parsed.data.NODE_ENV === "production" &&
  !hasRedisConnection
) {
  throw new Error(
    "Invalid environment variables: production requires REDIS_URL, UPSTASH_REDIS_HOST, or AWS_REDIS_HOST for Redis-backed cache, rate limits, BullMQ, and Socket.IO.",
  );
}

const normalizeMultiline = (value: string) => value.replace(/\\n/g, "\n");
const allowedOrigins = Array.from(
  new Set([parsed.data.CLIENT_URL, ...parsed.data.ALLOWED_ORIGINS].filter(Boolean)),
);

export const env = {
  ...parsed.data,
  JWT_ACCESS_SECRET: normalizeMultiline(parsed.data.JWT_ACCESS_SECRET),
  JWT_REFRESH_SECRET: normalizeMultiline(parsed.data.JWT_REFRESH_SECRET),
  ALLOWED_ORIGINS: allowedOrigins,
  AUTH_ALLOW_REDIS_AUTH_FALLBACK:
    parsed.data.AUTH_ALLOW_REDIS_AUTH_FALLBACK ?? parsed.data.NODE_ENV !== "production",
  BULLMQ_USE_REDIS: resolvedBullMqUseRedis,
};
