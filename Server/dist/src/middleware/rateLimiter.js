"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRateLimit = exports.apiLimiter = exports.authLimiter = void 0;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const ApiError_1 = require("../utils/ApiError");
exports.authLimiter = new ratelimit_1.Ratelimit({
    redis: redis_1.redis,
    limiter: ratelimit_1.Ratelimit.fixedWindow(10, '15m'),
    analytics: false,
    prefix: 'rl:auth',
});
exports.apiLimiter = new ratelimit_1.Ratelimit({
    redis: redis_1.redis,
    limiter: ratelimit_1.Ratelimit.slidingWindow(100, '1m'),
    analytics: false,
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
    if (!env_1.env.RATE_LIMIT_ENABLED) {
        return next();
    }
    const identifier = resolveKey(req);
    try {
        const { success, limit, reset, remaining } = await limiter.limit(identifier);
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(reset));
        if (!success) {
            return next(new ApiError_1.ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
        }
        return next();
    }
    catch (error) {
        (0, logger_1.logError)('Rate limiter unavailable, allowing request through', error);
        return next();
    }
};
exports.withRateLimit = withRateLimit;
