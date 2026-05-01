import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

/**
 * Per-route concurrency limit.
 *
 * Use for endpoints that are expensive but valid in moderation: report
 * generation, exports, bulk operations, leaderboards under heavy filtering.
 * The semaphore is in-process (per replica), which is exactly the right scope
 * — we want to bound CPU/memory on each pod, not globally. To bound globally,
 * pair this with rate limiting (which is Redis-backed).
 *
 * Example:
 *   const reportSemaphore = createConcurrencyLimit('reports', { maxInflight: 5 });
 *   router.get('/reports/export', reportSemaphore, exportReport);
 */

export interface ConcurrencyLimitOptions {
  maxInflight: number;
  /** Optional: queue waiting requests up to this many. Default 0 (no queue). */
  queueDepth?: number;
  /** Optional: max wait in ms before rejecting queued requests. Default 5000. */
  maxWaitMs?: number;
}

interface PendingResolver {
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

export const createConcurrencyLimit = (
  label: string,
  opts: ConcurrencyLimitOptions,
) => {
  let inFlight = 0;
  const waiters: PendingResolver[] = [];
  const maxWaitMs = opts.maxWaitMs ?? 5000;
  const queueDepth = opts.queueDepth ?? 0;

  const drain = () => {
    while (inFlight < opts.maxInflight && waiters.length > 0) {
      const waiter = waiters.shift()!;
      const waited = Date.now() - waiter.enqueuedAt;
      if (waited > maxWaitMs) {
        waiter.reject(new ApiError(503, 'CONCURRENCY_TIMEOUT', 'Request waited too long.'));
        continue;
      }
      inFlight += 1;
      waiter.resolve();
    }
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (inFlight < opts.maxInflight) {
      inFlight += 1;
    } else if (waiters.length < queueDepth) {
      try {
        await new Promise<void>((resolve, reject) => {
          waiters.push({ resolve, reject, enqueuedAt: Date.now() });
          setTimeout(() => {
            const idx = waiters.findIndex((w) => w.resolve === resolve);
            if (idx >= 0) {
              waiters.splice(idx, 1);
              reject(new ApiError(503, 'CONCURRENCY_TIMEOUT', 'Request waited too long.'));
            }
          }, maxWaitMs).unref?.();
        });
      } catch (error) {
        return next(error);
      }
    } else {
      logger.warn(`Concurrency limit hit on "${label}" (max=${opts.maxInflight})`);
      res.setHeader('Retry-After', '5');
      return next(
        new ApiError(503, 'CONCURRENCY_LIMIT', `Too many concurrent "${label}" requests.`),
      );
    }

    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      inFlight = Math.max(0, inFlight - 1);
      drain();
    };
    res.on('finish', release);
    res.on('close', release);

    next();
  };
};
