/**
 * Dedicated worker process — runs BullMQ workers without booting the API listener.
 *
 * Why a separate process: queue throughput should be predictable and not subject
 * to spikes in API CPU. Running workers inside API replicas couples the two and
 * makes capacity planning harder. Production: deploy one or more `npm run worker`
 * pods scaled independently from API pods.
 *
 * Flag `RUN_WORKERS_INLINE=true` keeps the legacy single-process behavior for
 * dev environments and small deployments.
 */

import { connectDB, disconnectDB } from './config/db';
import {
  initializeBullMqRedisTransport,
  shouldIgnoreBullMqUnhandledRejection,
  startQueueDepthPoller,
  stopQueueDepthPoller,
} from './config/bullmq';
import { startActivityWorker } from './jobs/activityWorker';
import { startNotificationWorker } from './jobs/notificationWorker';
import { startMongoExcelBackupWorker } from './jobs/mongoExcelBackupWorker';
import {
  startRetentionEmailWorker,
} from './jobs/retentionEmailWorker';
import { startScoreWorker } from './jobs/scoreRecalcWorker';
import { startMentorDecayWorker } from './jobs/mentorDecayWorker';
import { logError, logger } from './config/logger';
import http from 'http';
import { metricsHandler } from './middleware/metrics';
import { healthHandler, readinessHandler } from './middleware/health';

const METRICS_PORT = Number(process.env.WORKER_METRICS_PORT) || 9091;

const startMetricsServer = (): http.Server => {
  const server = http.createServer((req, res) => {
    if (req.url === '/metrics') return metricsHandler(req as never, res as never);
    if (req.url === '/healthz') return healthHandler(req as never, res as never);
    if (req.url === '/readyz') return readinessHandler(req as never, res as never);
    res.statusCode = 404;
    res.end('not found');
  });
  server.listen(METRICS_PORT, () => {
    logger.info(`Worker metrics server listening on :${METRICS_PORT}`);
  });
  return server;
};

const startWorker = async () => {
  await connectDB();
  await initializeBullMqRedisTransport();

  startActivityWorker();
  startScoreWorker();
  startNotificationWorker();
  startMongoExcelBackupWorker();
  startRetentionEmailWorker();
  startMentorDecayWorker();
  startQueueDepthPoller();

  const metricsServer = startMetricsServer();
  logger.info('Worker process started.');

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down Worker gracefully`);
    metricsServer.close(async () => {
      stopQueueDepthPoller();
      await disconnectDB();
      process.exit(0);
    });
    // BullMQ workers finish the current job then stop. Allow up to 25s.
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 25_000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

const shutdown = (type: string, error: unknown) => {
  logError(type, error);
  setTimeout(() => process.exit(1), 100);
};

process.on('uncaughtException', (error) => shutdown('uncaughtException', error));
process.on('unhandledRejection', (error) => {
  if (shouldIgnoreBullMqUnhandledRejection(error)) return;
  shutdown('unhandledRejection', error);
});

void startWorker().catch((error) => shutdown('Worker startup failed', error));
