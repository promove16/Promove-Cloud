import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { logError } from '../config/logger';
import { ApiError } from '../utils/ApiError';
import { idempotencyOps } from './metrics';

/**
 * Idempotency-Key middleware.
 *
 * Pattern: client sends an `Idempotency-Key` header on a write request. We
 * compute a fingerprint = sha256(method + path + bodyHash + userId) and store
 * the response under `idem:<key>:<fingerprint>` in Redis with a TTL.
 *
 * On replay (same key, same fingerprint), we return the cached response
 * verbatim — the user gets the original outcome and the handler does not run a
 * second time. On a different fingerprint with the same key (key reuse with a
 * different payload), we 409 — the client made a programming error.
 *
 * This is necessary for:
 *   - retried network failures (client times out, retries; without idempotency
 *     they may double-charge / double-create).
 *   - mobile clients on flaky networks.
 *   - any payment, deal, transaction, or "create unique resource" endpoint.
 *
 * Apply selectively to writes that need it:
 *   router.post('/deals', idempotency(), createDeal)
 *
 * The middleware is a no-op when no Idempotency-Key header is present, so it's
 * safe to layer onto endpoints whose clients haven't migrated yet.
 */

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

interface StoredResponse {
  status: number;
  body: unknown;
  fingerprint: string;
}

const sha256 = (input: string) => crypto.createHash('sha256').update(input).digest('hex');

const computeFingerprint = (req: Request): string => {
  const userId = (req as Request & { user?: { _id?: string; id?: string } }).user?._id
    || (req as Request & { user?: { _id?: string; id?: string } }).user?.id
    || 'anonymous';
  const bodyString = req.body ? JSON.stringify(req.body) : '';
  return sha256(`${req.method}:${req.originalUrl}:${userId}:${sha256(bodyString)}`);
};

export interface IdempotencyOptions {
  ttlSeconds?: number;
  /** Methods that should require idempotency. Default: POST, PUT, PATCH, DELETE. */
  methods?: string[];
}

export const idempotency =
  (opts: IdempotencyOptions = {}) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const methods = opts.methods || ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!methods.includes(req.method)) return next();

    const headerKey = req.header('idempotency-key');
    if (!headerKey || headerKey.length === 0 || headerKey.length > 200) return next();

    const fingerprint = computeFingerprint(req);
    const redisKey = `idem:${headerKey}`;

    let stored: StoredResponse | null = null;
    try {
      stored = await redis.get<StoredResponse>(redisKey);
    } catch (error) {
      // If Redis is degraded, fail open: better to serve a (possibly duplicate)
      // request than to drop legitimate writes. The metric flags it.
      logError(`idempotency: redis get(${redisKey}) failed`, error);
      idempotencyOps.inc({ outcome: 'error' });
      return next();
    }

    if (stored) {
      if (stored.fingerprint !== fingerprint) {
        idempotencyOps.inc({ outcome: 'conflict' });
        return next(
          new ApiError(
            409,
            'IDEMPOTENCY_KEY_CONFLICT',
            'Idempotency-Key was reused with a different request payload.',
          ),
        );
      }

      idempotencyOps.inc({ outcome: 'replayed' });
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(stored.status).json(stored.body);
    }

    // Capture the outgoing JSON response so we can store it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful + client-error responses (skip 5xx so transient
      // failures don't get pinned). The exact status range is configurable.
      if (res.statusCode < 500) {
        const ttl = opts.ttlSeconds || DEFAULT_TTL_SECONDS;
        const payload: StoredResponse = { status: res.statusCode, body, fingerprint };
        redis
          .set(redisKey, payload, { ex: ttl })
          .then(() => idempotencyOps.inc({ outcome: 'stored' }))
          .catch((error) => {
            logError(`idempotency: redis set(${redisKey}) failed`, error);
            idempotencyOps.inc({ outcome: 'error' });
          });
      }
      return originalJson(body);
    };

    next();
  };
