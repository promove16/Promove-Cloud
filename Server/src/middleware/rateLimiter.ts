import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

const redis = Redis.fromEnv();

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '15m'),
  analytics: true,
  prefix: 'rl:auth',
});

export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  analytics: true,
  prefix: 'rl:api',
});

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
    const identifier = resolveKey(req);
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
  };
