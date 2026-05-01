import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

/**
 * Dependency-aware backpressure / load-shedding middleware.
 *
 * If Mongo is disconnected, fail fast with 503 instead of letting requests pile up
 * on a dead pool (which produces tail-latency spikes and cascading failures).
 *
 * If the global in-flight count exceeds MAX_INFLIGHT, shed new requests with 503
 * to preserve capacity for in-progress work. Tune MAX_INFLIGHT per replica based
 * on benchmarks; default 1000 is conservative for typical Node API replicas.
 */

const MAX_INFLIGHT = Number(process.env.MAX_INFLIGHT_REQUESTS) || 1000;
const SHED_LOG_INTERVAL_MS = 5000;

let inFlight = 0;
let lastShedLog = 0;

const SAFE_PATHS = new Set(['/healthz', '/readyz', '/metrics']);

export const backpressureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_PATHS.has(req.path)) return next();

  // 1) Mongo not connected — fail fast.
  if (mongoose.connection.readyState !== 1) {
    return next(
      new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Database temporarily unavailable. Please retry.'),
    );
  }

  // 2) Too many in-flight requests — shed.
  if (inFlight >= MAX_INFLIGHT) {
    const now = Date.now();
    if (now - lastShedLog > SHED_LOG_INTERVAL_MS) {
      lastShedLog = now;
      logger.warn(`Backpressure shed: in-flight=${inFlight} max=${MAX_INFLIGHT}`);
    }
    res.setHeader('Retry-After', '1');
    return next(new ApiError(503, 'OVERLOADED', 'Server is temporarily overloaded. Please retry.'));
  }

  inFlight += 1;
  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    inFlight = Math.max(0, inFlight - 1);
  };
  res.on('finish', release);
  res.on('close', release);

  next();
};

export const getInFlightCount = () => inFlight;
