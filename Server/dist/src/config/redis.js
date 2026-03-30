"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const redis_1 = require("@upstash/redis");
const env_1 = require("./env");
// Profile caching
// profile:{profileSlug}           Hash    TTL: 2 min    Public profile page data
// profile-views:{userId}          String  TTL: 24h      Profile view count (today)
//
// GitHub sync state
// github-sync:{userId}            String  TTL: 1h       Prevents double-sync requests
// github-data:{userId}            Hash    TTL: 30 min   Cached GitHub API response
//
// LinkedIn sync state
// linkedin-sync:{userId}          String  TTL: 1h       Prevents double-sync requests
//
// Team request counts
// team-requests:{userId}          String  TTL: 5 min    Unread team request count
exports.redis = redis_1.Redis.fromEnv({
    keepAlive: true,
    retry: {
        retries: env_1.env.REDIS_REQUEST_RETRIES,
        backoff: () => 50,
    },
    signal: () => AbortSignal.timeout(env_1.env.REDIS_REQUEST_TIMEOUT_MS),
});
