"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRateLimit = exports.apiLimiter = exports.authLimiter = void 0;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
const ApiError_1 = require("../utils/ApiError");
const redis = redis_1.Redis.fromEnv();
exports.authLimiter = new ratelimit_1.Ratelimit({
    redis,
    limiter: ratelimit_1.Ratelimit.fixedWindow(10, '15m'),
    analytics: true,
    prefix: 'rl:auth',
});
exports.apiLimiter = new ratelimit_1.Ratelimit({
    redis,
    limiter: ratelimit_1.Ratelimit.slidingWindow(100, '1m'),
    analytics: true,
    prefix: 'rl:api',
});
const resolveKey = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
        return forwarded[0];
    }
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || req.ip || 'anonymous';
    }
    return req.ip || 'anonymous';
};
const withRateLimit = (limiter) => async (req, res, next) => {
    const identifier = resolveKey(req);
    const { success, limit, reset, remaining } = await limiter.limit(identifier);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(reset));
    if (!success) {
        return next(new ApiError_1.ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
    }
    return next();
};
exports.withRateLimit = withRateLimit;
