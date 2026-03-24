import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  UPSTASH_REDIS_HOST: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES: z.string().min(1).default('30d'),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().min(1),
  MAX_USERS_YEAR_ONE: z.coerce.number().int().positive().default(2000),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  FROM_EMAIL: z.string().default('noreply@promovecyc.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(missing)}`);
}

const normalizeMultiline = (value: string) => value.replace(/\\n/g, '\n');

const derivedRedisHost =
  parsed.data.UPSTASH_REDIS_HOST ??
  (() => {
    try {
      return new URL(parsed.data.UPSTASH_REDIS_REST_URL).hostname;
    } catch {
      return '';
    }
  })();

export const env = {
  ...parsed.data,
  UPSTASH_REDIS_HOST: derivedRedisHost,
  JWT_ACCESS_SECRET: normalizeMultiline(parsed.data.JWT_ACCESS_SECRET),
  JWT_REFRESH_SECRET: normalizeMultiline(parsed.data.JWT_REFRESH_SECRET),
};
