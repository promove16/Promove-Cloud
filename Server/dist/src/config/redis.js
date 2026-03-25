"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const redis_1 = require("@upstash/redis");
const env_1 = require("./env");
exports.redis = redis_1.Redis.fromEnv({
    keepAlive: true,
    retry: {
        retries: env_1.env.REDIS_REQUEST_RETRIES,
        backoff: () => 50,
    },
    signal: () => AbortSignal.timeout(env_1.env.REDIS_REQUEST_TIMEOUT_MS),
});
