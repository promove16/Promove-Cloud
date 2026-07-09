import http from 'http';
import app from './app';
import {
  initializeBullMqRedisTransport,
  shouldIgnoreBullMqUnhandledRejection,
  startQueueDepthPoller,
} from './config/bullmq';
import { startActivityWorker } from './jobs/activityWorker';
import { startNotificationWorker } from './jobs/notificationWorker';
import { scheduleMongoExcelBackupJob, startMongoExcelBackupWorker } from './jobs/mongoExcelBackupWorker';
import { scheduleWeeklyProgressSummaryJob, startRetentionEmailWorker } from './jobs/retentionEmailWorker';
import { scheduleBidExpiryJob, startBidExpiryWorker } from './jobs/biddingWorker';
import { startScoreWorker } from './jobs/scoreRecalcWorker';
import { startMentorDecayWorker, scheduleMentorDecayJob } from './jobs/mentorDecayWorker';
import { seedProblemsIfEmpty } from './modules/problemBank/problem.service';
import { initSocket } from './config/socket';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logError, logger, logFile } from './config/logger';

/**
 * RUN_WORKERS_INLINE: legacy single-process mode. Default ON in development so
 * `npm run dev` keeps working unchanged. In production we want it OFF so API
 * replicas scale independently of queue capacity. Set explicitly via env to
 * override.
 */
const runWorkersInline = (() => {
  if (process.env.RUN_WORKERS_INLINE === 'true') return true;
  if (process.env.RUN_WORKERS_INLINE === 'false') return false;
  return env.NODE_ENV !== 'production';
})();

const startServer = async () => {
  await connectDB();
  await seedProblemsIfEmpty();

  const httpServer = http.createServer(app);
  await initSocket(httpServer);

  if (env.NODE_ENV !== 'test') {
    // API replicas always need the queue *client* connected (request handlers
    // enqueue jobs). Worker processors only boot if RUN_WORKERS_INLINE=true.
    await initializeBullMqRedisTransport();
    startQueueDepthPoller();

    if (runWorkersInline) {
      logger.info('Booting BullMQ workers inline with the API process.');
      startActivityWorker();
      startScoreWorker();
      startNotificationWorker();
      startMongoExcelBackupWorker();
      startRetentionEmailWorker();
      startBidExpiryWorker();
      startMentorDecayWorker();
      await scheduleWeeklyProgressSummaryJob();
      await scheduleMongoExcelBackupJob();
      await scheduleBidExpiryJob();
      await scheduleMentorDecayJob();
    } else {
      logger.info('API replica started without inline workers (RUN_WORKERS_INLINE=false).');
    }
  }

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server listening on port ${env.PORT}. Writing logs to ${logFile}`);
  });
};

const shutdownWithLoggedError = (type: string, error: unknown) => {
  logError(type, error);
  setTimeout(() => process.exit(1), 100);
};

process.on('uncaughtException', (error) => {
  shutdownWithLoggedError('uncaughtException', error);
});

process.on('unhandledRejection', (error) => {
  if (shouldIgnoreBullMqUnhandledRejection(error)) {
    return;
  }

  shutdownWithLoggedError('unhandledRejection', error);
});

void startServer().catch((error) => {
  shutdownWithLoggedError('Server startup failed', error);
});
