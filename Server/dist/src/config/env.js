"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    MONGODB_URI: zod_1.z.string().min(1),
    UPSTASH_REDIS_REST_URL: zod_1.z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string().min(1),
    UPSTASH_REDIS_HOST: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(1),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1),
    JWT_ACCESS_EXPIRES: zod_1.z.string().min(1).default('15m'),
    JWT_REFRESH_EXPIRES: zod_1.z.string().min(1).default('30d'),
    PORT: zod_1.z.coerce.number().int().positive().default(5000),
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    CLIENT_URL: zod_1.z.string().min(1),
    MAX_USERS_YEAR_ONE: zod_1.z.coerce.number().int().positive().default(2000),
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
const normalizeMultiline = (value) => value.replace(/\\n/g, '\n');
exports.env = {
    ...parsed.data,
    JWT_ACCESS_SECRET: normalizeMultiline(parsed.data.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: normalizeMultiline(parsed.data.JWT_REFRESH_SECRET),
};
