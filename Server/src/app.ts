import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiLimiter, withRateLimit } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import chatRoutes from './modules/chat/chat.routes';
import marketplaceRoutes from './modules/marketplace/marketplace.routes';
import notificationRoutes from './modules/notification/notification.routes';
import patentRoutes from './modules/patent/patent.routes';
import problemRoutes from './modules/problemBank/problem.routes';
import scoreRoutes from './modules/innovationScore/score.routes';
import startupRoutes from './modules/startup/startup.routes';
import userRoutes from './modules/user/user.routes';
import workspaceRoutes from './modules/workspace/workspace.routes';
import { ApiError } from './utils/ApiError';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use('/api', withRateLimit(apiLimiter));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/score', scoreRoutes);
  app.use('/api/problems', problemRoutes);
  app.use('/api/workspace', workspaceRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/patents', patentRoutes);
  app.use('/api/startup', startupRoutes);
  app.use('/api/marketplace', marketplaceRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });
  app.use((_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
  });
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
