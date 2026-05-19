import http from 'http';
import { initializeBullMqRedisTransport, shouldIgnoreBullMqUnhandledRejection } from './config/bullmq';
import { connectDB, disconnectDB } from './config/db';
import { logError, logger } from './config/logger';
import { scheduleBidExpiryJob } from './jobs/biddingWorker';
import { scheduleWeeklyProgressSummaryJob } from './jobs/retentionEmailWorker';
import { scheduleMongoExcelBackupJob } from './jobs/mongoExcelBackupWorker';
import { healthHandler, readinessHandler } from './middleware/health';
import { metricsHandler } from './middleware/metrics';

const SCHEDULER_HEALTH_PORT = Number(process.env.SCHEDULER_HEALTH_PORT) || 9092;
const RESCHEDULE_INTERVAL_MS = Number(process.env.SCHEDULER_RESCHEDULE_INTERVAL_MS) || 60 * 60 * 1000;

const startHealthServer = (): http.Server => {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      return healthHandler(req as never, res as never);
    }
    if (req.url === '/readyz') {
      return readinessHandler(req as never, res as never);
    }
    if (req.url === '/metrics') {
      return metricsHandler(req as never, res as never);
    }

    res.statusCode = 404;
    res.end('not found');
  });

  server.listen(SCHEDULER_HEALTH_PORT, '0.0.0.0', () => {
    logger.info(`Scheduler health server listening on :${SCHEDULER_HEALTH_PORT}`);
  });

  return server;
};

const scheduleRecurringJobs = async () => {
  await scheduleWeeklyProgressSummaryJob();
  await scheduleMongoExcelBackupJob();
  await scheduleBidExpiryJob();
};

const startScheduler = async () => {
  await connectDB();
  await initializeBullMqRedisTransport();
  await scheduleRecurringJobs();

  const rescheduleInterval = setInterval(() => {
    void scheduleRecurringJobs().catch((error) => {
      logError('Scheduler recurring registration failed', error);
    });
  }, RESCHEDULE_INTERVAL_MS);
  rescheduleInterval.unref?.();

  const healthServer = startHealthServer();
  logger.info('Scheduler service started.');

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down Scheduler gracefully`);
    clearInterval(rescheduleInterval);
    healthServer.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
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

void startScheduler().catch((error) => shutdown('Scheduler startup failed', error));
