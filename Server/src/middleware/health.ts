import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis';
import { getServicePolicy } from '../config/serviceAvailability';
import { logError } from '../config/logger';

/**
 * /healthz — liveness. Always returns 200 unless the process is broken enough to
 *           not respond at all. Used by orchestrators to decide whether to restart.
 */
export const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
};

/**
 * /readyz — readiness. 200 only when dependencies (Mongo, Redis) are reachable.
 *          Used by load balancers to decide whether to send traffic.
 */
export const readinessHandler = async (_req: Request, res: Response) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  let overallOk = true;

  // Mongo: readyState 1 == connected
  const mongoPolicy = getServicePolicy('mongodb');
  const mongoOk = mongoose.connection.readyState === 1;
  checks.mongo = {
    ok: mongoOk,
    ...(mongoOk ? {} : { error: `${mongoPolicy.serviceName} is not connected` }),
  };
  if (!mongoOk && mongoPolicy.required) overallOk = false;

  // Redis: ping with strict timeout
  const redisPolicy = getServicePolicy('redis');
  const redisStart = Date.now();
  try {
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis ping timeout')), 1000)),
    ]);
    checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
  } catch (error) {
    if (redisPolicy.required) {
      overallOk = false;
    }
    checks.redis = {
      ok: false,
      latencyMs: Date.now() - redisStart,
      error: `${redisPolicy.serviceName} is not working. Contact ${redisPolicy.supportEmail}. ${(error as Error).message}`,
    };
    logError('readyz: redis check failed', error);
  }

  res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'ready' : 'not_ready',
    mode: redisPolicy.mode,
    supportEmail: redisPolicy.supportEmail,
    checks,
  });
};
