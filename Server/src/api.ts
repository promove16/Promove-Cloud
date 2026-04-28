import http from 'http';
import app from './app';
import {
  initializeBullMqRedisTransport,
  shouldIgnoreBullMqUnhandledRejection,
  startQueueDepthPoller,
  stopQueueDepthPoller,
} from './config/bullmq';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logError, logger, logFile } from './config/logger';

const startApi = async () => {
  await connectDB();

  if (env.NODE_ENV !== 'test') {
    await initializeBullMqRedisTransport();
    startQueueDepthPoller();
  }

  const server = http.createServer(app);
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API service listening on port ${env.PORT}. Writing logs to ${logFile}`);
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down API gracefully`);
    server.close(async () => {
      stopQueueDepthPoller();
      await disconnectDB();
      process.exit(0);
    });
    // Force exit after 25s in case in-flight requests do not drain in time.
    // ECS default stopTimeout is 30s, so this exits cleanly before SIGKILL.
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 25_000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
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

void startApi().catch((error) => {
  shutdownWithLoggedError('API startup failed', error);
});
