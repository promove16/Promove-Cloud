import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logError } from '../config/logger';
import { ApiError } from '../utils/ApiError';
import { rateLimitDecisions } from './metrics';

type RateLimiter = {
  prefix: string;
  limit: (identifier: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

const createFixedWindowLimiter = (prefix: string, maxRequests: number, windowSeconds: number): RateLimiter => ({
  prefix,
  async limit(identifier: string) {
    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `${prefix}:${identifier}:${windowId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const reset = (windowId + 1) * windowSeconds * 1000;
    const remaining = Math.max(maxRequests - count, 0);

    return {
      success: count <= maxRequests,
      limit: maxRequests,
      remaining,
      reset,
    };
  },
});

export const authLimiter = createFixedWindowLimiter('rl:auth', 10, 15 * 60);
export const apiLimiter = createFixedWindowLimiter('rl:api', 100, 60);
export const writeLimiter = createFixedWindowLimiter('rl:write', 30, 60);

const resolveKey = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'anonymous';
  }

  return req.ip || 'anonymous';
};

export const withRateLimit =
  (limiter: RateLimiter) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!env.RATE_LIMIT_ENABLED) {
      rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'disabled' });
      return next();
    }

    const identifier = resolveKey(req);
    try {
      const { success, limit, reset, remaining } = await limiter.limit(identifier);

      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(reset));

      if (!success) {
        rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'blocked' });
        return next(
          new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'),
        );
      }

      rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'allowed' });
      return next();
    } catch (error) {
      // Fail-open: if Redis is degraded, do not block users but record loudly.
      logError('Rate limiter unavailable, allowing request through', error);
      rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'fail_open' });
      return next();
    }
  };
