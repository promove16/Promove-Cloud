"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const booleanFromEnv = zod_1.z.preprocess((value) => {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
    }
    return value;
}, zod_1.z.boolean());
const envSchema = zod_1.z.object({
    MONGODB_URI: zod_1.z.string().min(1),
    UPSTASH_REDIS_REST_URL: zod_1.z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string().min(1),
    UPSTASH_REDIS_HOST: zod_1.z.string().min(1),
    UPSTASH_REDIS_PASSWORD: zod_1.z.string().min(1).optional(),
    REDIS_REQUEST_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(1500),
    REDIS_REQUEST_RETRIES: zod_1.z.coerce.number().int().min(0).default(0),
    BULLMQ_CONNECT_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(5000),
    BULLMQ_COMMAND_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(5000),
    JWT_ACCESS_SECRET: zod_1.z.string().min(1),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1),
    JWT_ACCESS_EXPIRES: zod_1.z.string().min(1).default("15m"),
    JWT_REFRESH_EXPIRES: zod_1.z.string().min(1).default("30d"),
    PORT: zod_1.z.coerce.number().int().positive().default(5000),
    NODE_ENV: zod_1.z
        .enum(["development", "test", "production"])
        .default("development"),
    RATE_LIMIT_ENABLED: booleanFromEnv.default(true),
    CLIENT_URL: zod_1.z.string().min(1),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().min(1),
    CLOUDINARY_API_KEY: zod_1.z.string().min(1),
    CLOUDINARY_API_SECRET: zod_1.z.string().min(1),
    AWS_REGION: zod_1.z.string().min(1),
    AWS_ACCESS_KEY_ID: zod_1.z.string().min(1),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().min(1),
    FROM_EMAIL: zod_1.z.string().min(1),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const missing = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment variables: ${JSON.stringify(missing)}`);
}
const normalizeMultiline = (value) => value.replace(/\\n/g, "\n");
exports.env = {
    ...parsed.data,
    JWT_ACCESS_SECRET: normalizeMultiline(parsed.data.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: normalizeMultiline(parsed.data.JWT_REFRESH_SECRET),
};
