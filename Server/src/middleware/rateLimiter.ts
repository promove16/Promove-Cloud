import { Ratelimit } from '@upstash/ratelimit';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logError } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '15m'),
  analytics: false,
  prefix: 'rl:auth',
});

export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  analytics: false,
  prefix: 'rl:api',
});

// Temporary bypass for Render load testing. Re-enable after the 200-VU run.
const RATE_LIMIT_BYPASSED_FOR_LOAD_TEST = true;

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
  (limiter: Ratelimit) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (RATE_LIMIT_BYPASSED_FOR_LOAD_TEST || !env.RATE_LIMIT_ENABLED) {
      return next();
    }

    const identifier = resolveKey(req);
    try {
      const { success, limit, reset, remaining } = await limiter.limit(identifier);

      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(reset));

      if (!success) {
        return next(
          new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'),
        );
      }

      return next();
    } catch (error) {
      logError('Rate limiter unavailable, allowing request through', error);
      return next();
    }
  };
