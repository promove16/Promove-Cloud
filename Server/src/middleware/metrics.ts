import { NextFunction, Request, Response } from 'express';
import client, { Counter, Gauge, Histogram } from 'prom-client';
import os from 'os';

/**
 * Production-grade metrics for ProMove.
 *
 * Conventions:
 *   - Histograms use seconds (Prometheus best practice).
 *   - Labels are kept low-cardinality. NEVER label by raw URL — use req.route.path.
 *   - Workers and the API both share this registry (each replica publishes its own /metrics).
 *
 * Scrape: GET /metrics
 */

export const registry = new client.Registry();

registry.setDefaultLabels({
  service: 'promove-server',
  instance: process.env.INSTANCE_ID || os.hostname(),
});

client.collectDefaultMetrics({ register: registry });

// -------------------- HTTP --------------------

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code', 'cost_class'],
  // Targets: read p95 < 250ms, write p95 < 500ms.
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'HTTP responses with status >= 400',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const inFlightRequests = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Currently in-flight HTTP requests',
  labelNames: ['route'],
  registers: [registry],
});

// -------------------- Rate limiting --------------------

export const rateLimitDecisions = new Counter({
  name: 'rate_limit_decisions_total',
  help: 'Rate-limit decisions partitioned by limiter and outcome',
  labelNames: ['limiter', 'decision'],
  registers: [registry],
});

// -------------------- BullMQ queues --------------------

export const queueJobsProcessed = new Counter({
  name: 'queue_jobs_processed_total',
  help: 'BullMQ jobs processed by queue and status',
  labelNames: ['queue', 'status'], // status: completed | failed | dlq
  registers: [registry],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue'],
  buckets: [0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [registry],
});

export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'BullMQ queue depth by state (waiting | active | delayed | failed)',
  labelNames: ['queue', 'state'],
  registers: [registry],
});

export const queueWaitTime = new Histogram({
  name: 'queue_wait_seconds',
  help: 'Time a job spent waiting before processing (queue lag)',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 300],
  registers: [registry],
});

// -------------------- Socket.IO --------------------

export const socketConnections = new Gauge({
  name: 'socket_connections',
  help: 'Active Socket.IO connections by namespace',
  labelNames: ['namespace'],
  registers: [registry],
});

export const socketEvents = new Counter({
  name: 'socket_events_total',
  help: 'Socket.IO events emitted/received',
  labelNames: ['namespace', 'event', 'direction'],
  registers: [registry],
});

export const socketReconnects = new Counter({
  name: 'socket_reconnects_total',
  help: 'Socket reconnection outcomes',
  labelNames: ['namespace', 'outcome'], // outcome: success | failure
  registers: [registry],
});

// -------------------- Dependencies --------------------

export const mongoQueryDuration = new Histogram({
  name: 'mongo_query_duration_seconds',
  help: 'Mongo query duration in seconds (via mongoose middleware)',
  labelNames: ['model', 'op'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Redis command duration in seconds',
  labelNames: ['command', 'outcome'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

export const cacheOps = new Counter({
  name: 'cache_ops_total',
  help: 'Cache-aside operations',
  labelNames: ['cache', 'op'], // op: hit | miss | set | invalidate | error
  registers: [registry],
});

// -------------------- Cost telemetry --------------------

export const requestCostByClass = new Counter({
  name: 'request_cost_class_total',
  help: 'Requests classified by cost class for cost attribution',
  labelNames: ['cost_class', 'route'],
  registers: [registry],
});

// -------------------- Idempotency --------------------

export const idempotencyOps = new Counter({
  name: 'idempotency_ops_total',
  help: 'Idempotency middleware operations',
  labelNames: ['outcome'], // outcome: stored | replayed | conflict | error
  registers: [registry],
});

// -------------------- Express middleware --------------------

/**
 * Records HTTP request duration and error counts.
 * Uses req.route.path (not req.path) to keep label cardinality bounded.
 */
export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  const routeForGauge = req.path; // best-effort label before route is resolved
  inFlightRequests.inc({ route: routeForGauge });

  const finalize = () => {
    res.removeListener('finish', finalize);
    res.removeListener('close', finalize);

    inFlightRequests.dec({ route: routeForGauge });

    // Prefer the matched route pattern. Fallback keeps cardinality bounded.
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.baseUrl || 'unmatched';
    const statusCode = String(res.statusCode);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const costClass = (res.locals?.costClass as string) || 'default';

    httpRequestDuration.observe(
      { method: req.method, route, status_code: statusCode, cost_class: costClass },
      seconds,
    );

    if (res.statusCode >= 400) {
      httpRequestErrors.inc({ method: req.method, route, status_code: statusCode });
    }

    if (res.locals?.costClass) {
      requestCostByClass.inc({ cost_class: costClass, route });
    }
  };

  res.on('finish', finalize);
  res.on('close', finalize);

  next();
};

/**
 * Mark a request with a cost class for attribution.
 *   router.get('/heavy', costClass('db-heavy'), handler)
 */
export const costClass = (className: string) => (_req: Request, res: Response, next: NextFunction) => {
  res.locals.costClass = className;
  next();
};

/**
 * Express handler for GET /metrics.
 */
export const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (error) {
    res.status(500).end((error as Error).message);
  }
};
