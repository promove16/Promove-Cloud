import express from 'express';
import http from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logError, logger, logFile } from './config/logger';
import { initSocket } from './config/socket';
import { healthHandler, readinessHandler } from './middleware/health';
import { metricsHandler } from './middleware/metrics';

const createRealtimeApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(compression());
  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    }),
  );

  app.get('/health', healthHandler);
  app.get('/healthz', healthHandler);
  app.get('/readyz', readinessHandler);
  app.get('/metrics', metricsHandler);

  return app;
};

const startRealtime = async () => {
  await connectDB();

  const httpServer = http.createServer(createRealtimeApp());
  await initSocket(httpServer);

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Realtime service listening on port ${env.PORT}. Writing logs to ${logFile}`);
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down Realtime gracefully`);
    httpServer.close(async () => {
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

const shutdownWithLoggedError = (type: string, error: unknown) => {
  logError(type, error);
  setTimeout(() => process.exit(1), 100);
};

process.on('uncaughtException', (error) => {
  shutdownWithLoggedError('uncaughtException', error);
});

process.on('unhandledRejection', (error) => {
  shutdownWithLoggedError('unhandledRejection', error);
});

void startRealtime().catch((error) => {
  shutdownWithLoggedError('Realtime startup failed', error);
});
