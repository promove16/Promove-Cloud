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
    } else {
      // Crash recovery: if the EXPIRE after INCR was missed in a prior run,
      // the key persists with no TTL. Detect and fix it here.
      const ttl = await redis.ttl(key);
      if (ttl === -1) await redis.expire(key, windowSeconds);
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

// Prefer authenticated user ID so campus NATs / shared IPs do not bleed limits
// across users. Falls back to req.ip (Express resolves this correctly via
// app.set('trust proxy', 1) — never read x-forwarded-for directly).
const resolveKey = (req: Request): string => {
  if (req.user?._id) return `user:${req.user._id}`;
  return `ip:${req.ip ?? 'anonymous'}`;
};

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Local dev/test agents (e.g. Antigravity hitting a locally-run server) hammer
// endpoints far faster than a real user ever would. Only loopback traffic is
// exempt, so this can never be used to bypass limits from outside the box.
const isLocalhost = (req: Request): boolean => !!req.ip && LOOPBACK_IPS.has(req.ip);

export const withRateLimit =
  (limiter: RateLimiter) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!env.RATE_LIMIT_ENABLED) {
      rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'disabled' });
      return next();
    }

    if (env.NODE_ENV !== 'production' && isLocalhost(req)) {
      rateLimitDecisions.inc({ limiter: limiter.prefix, decision: 'localhost_bypass' });
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
        res.setHeader('Retry-After', String(Math.ceil((reset - Date.now()) / 1000)));
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
