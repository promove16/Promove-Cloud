import http from 'http';
import app from './app';
import { initializeBullMqRedisTransport, shouldIgnoreBullMqUnhandledRejection } from './config/bullmq';
import { startActivityWorker } from './jobs/activityWorker';
import { startNotificationWorker } from './jobs/notificationWorker';
import { scheduleWeeklyProgressSummaryJob, startRetentionEmailWorker } from './jobs/retentionEmailWorker';
import { startScoreWorker } from './jobs/scoreRecalcWorker';
import { seedProblemsIfEmpty } from './modules/problemBank/problem.service';
import { initSocket } from './config/socket';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logError, logger, logFile } from './config/logger';

const startServer = async () => {
  await connectDB();
  await seedProblemsIfEmpty();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  if (env.NODE_ENV !== 'test') {
    await initializeBullMqRedisTransport();
    startActivityWorker();
    startScoreWorker();
    startNotificationWorker();
    startRetentionEmailWorker();
    await scheduleWeeklyProgressSummaryJob();
  }

  httpServer.listen(env.PORT, () => {
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
