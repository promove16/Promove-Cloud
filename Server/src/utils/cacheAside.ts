import { redis } from '../config/redis';
import { logError, logger } from '../config/logger';
import { cacheOps, redisCommandDuration } from '../middleware/metrics';

/**
 * Cache-aside read helper with three production properties:
 *
 *   1. Stampede protection (single-flight): if N concurrent requests miss the
 *      cache for the same key inside a single process, only one fetcher runs;
 *      the others await its result. This prevents the classic "thundering herd"
 *      against Mongo when a hot key expires.
 *
 *   2. Stale-while-revalidate: if `swr` is enabled and a value is past its
 *      `softTtl` but within `hardTtl`, we return the stale value immediately
 *      and refresh the cache asynchronously. End-user latency stays low even
 *      during a spike.
 *
 *   3. Fail-open: if Redis is degraded, we log + emit a metric and fall through
 *      to the database. Cached read paths must NEVER block on Redis.
 *
 * Keys should be namespaced (e.g. `profile:<slug>`). Invalidate via
 * `cacheInvalidate(key)` from any write path that mutates the underlying data.
 */

export interface CacheOptions {
  /** Time before a value is considered stale and eligible for SWR refresh. */
  softTtlSeconds: number;
  /** Hard TTL — the key disappears after this. */
  hardTtlSeconds: number;
  /** Logical name for metrics labels (e.g. "profile", "marketplace"). */
  cacheName: string;
  /** Disable SWR if you want strict freshness. Default: true. */
  swr?: boolean;
}

interface Envelope<T> {
  v: T;
  /** Wall-clock unix ms when this entry was written. */
  t: number;
  /** Soft TTL in ms relative to t. */
  s: number;
}

const inFlight = new Map<string, Promise<unknown>>();

const timed = async <T>(command: string, fn: () => Promise<T>): Promise<T> => {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    redisCommandDuration.observe({ command, outcome: 'ok' }, seconds);
    return result;
  } catch (error) {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    redisCommandDuration.observe({ command, outcome: 'error' }, seconds);
    throw error;
  }
};

const safeGet = async <T>(key: string): Promise<Envelope<T> | null> => {
  try {
    const raw = await timed('get', () => redis.get<Envelope<T>>(key));
    return raw ?? null;
  } catch (error) {
    logError(`cacheAside: get(${key}) failed`, error);
    return null;
  }
};

const safeSet = async <T>(
  key: string,
  envelope: Envelope<T>,
  hardTtlSeconds: number,
): Promise<void> => {
  try {
    await timed('set', () => redis.set(key, envelope, { ex: hardTtlSeconds }));
  } catch (error) {
    logError(`cacheAside: set(${key}) failed`, error);
  }
};

/**
 * Get-or-fetch with single-flight + optional SWR.
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CacheOptions,
): Promise<T> {
  const swr = opts.swr ?? true;

  const cached = await safeGet<T>(key);

  if (cached) {
    const age = Date.now() - cached.t;
    const isStale = age > cached.s;

    if (!isStale) {
      cacheOps.inc({ cache: opts.cacheName, op: 'hit' });
      return cached.v;
    }

    if (swr) {
      // Return stale immediately, kick off async refresh.
      cacheOps.inc({ cache: opts.cacheName, op: 'hit' });
      void refreshInBackground(key, fetcher, opts);
      return cached.v;
    }
  }

  cacheOps.inc({ cache: opts.cacheName, op: 'miss' });

  // Single-flight: collapse concurrent misses for the same key into one fetch.
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const fetchPromise = (async () => {
    try {
      const value = await fetcher();
      const envelope: Envelope<T> = {
        v: value,
        t: Date.now(),
        s: opts.softTtlSeconds * 1000,
      };
      await safeSet(key, envelope, opts.hardTtlSeconds);
      cacheOps.inc({ cache: opts.cacheName, op: 'set' });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, fetchPromise);
  return fetchPromise;
}

const refreshInBackground = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CacheOptions,
) => {
  if (inFlight.has(key)) return; // already refreshing
  const promise = (async () => {
    try {
      const value = await fetcher();
      const envelope: Envelope<T> = {
        v: value,
        t: Date.now(),
        s: opts.softTtlSeconds * 1000,
      };
      await safeSet(key, envelope, opts.hardTtlSeconds);
      cacheOps.inc({ cache: opts.cacheName, op: 'set' });
    } catch (error) {
      cacheOps.inc({ cache: opts.cacheName, op: 'error' });
      logger.warn(`cacheAside: background refresh failed for ${key}: ${(error as Error).message}`);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
};

/**
 * Invalidate one or many cache keys. Call this from write paths.
 */
export const cacheInvalidate = async (
  cacheName: string,
  keys: string | string[],
): Promise<void> => {
  const list = Array.isArray(keys) ? keys : [keys];
  if (list.length === 0) return;

  for (const key of list) {
    try {
      await timed('del', () => redis.del(key));
      cacheOps.inc({ cache: cacheName, op: 'invalidate' });
    } catch (error) {
      cacheOps.inc({ cache: cacheName, op: 'error' });
      logError(`cacheAside: invalidate(${key}) failed`, error);
    }
  }
};

/**
 * Convenience: namespace a key consistently. `profile:slug:abc` etc.
 */
export const cacheKey = (...parts: (string | number)[]): string => parts.join(':');
