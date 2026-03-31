import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { existsSync } from 'fs';
import { env } from './config/env';
import { httpLogStream } from './config/logger';
import { apiLimiter, withRateLimit } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import chatRoutes from './modules/chat/chat.routes';
import collegeRoutes from './modules/college/college.routes';
import dealRoutes, { startupsInvestmentRouter } from './modules/deal/deal.routes';
import eventRoutes from './modules/event/event.routes';
import investorRoutes from './modules/investor/investor.routes';
import marketplaceRoutes from './modules/marketplace/marketplace.routes';
import notificationRoutes from './modules/notification/notification.routes';
import patentRoutes from './modules/patent/patent.routes';
import problemRoutes from './modules/problemBank/problem.routes';
import recruiterRoutes from './modules/recruiter/recruiter.routes';
import schoolRoutes from './modules/school/school.routes';
import scoreRoutes from './modules/innovationScore/score.routes';
import mentorRoutes from './modules/mentor/mentor.routes';
import startupRoutes from './modules/startup/startup.routes';
import userRoutes from './modules/user/user.routes';
import workspaceRoutes from './modules/workspace/workspace.routes';
import adminRoutes from './modules/admin/admin.routes';
import dmRoutes from './modules/dm/dm.routes';
import reportRoutes from './modules/report/report.routes';
import settingsRoutes from './modules/settings/settings.routes';
import { ApiError } from './utils/ApiError';

export const createApp = () => {
  const app = express();
  const clientBuildPath = path.resolve(__dirname, '../../public');
  const hasClientBuild = existsSync(clientBuildPath);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: httpLogStream,
    }),
  );
  app.use('/api', withRateLimit(apiLimiter));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/score', scoreRoutes);
  app.use('/api/problems', problemRoutes);
  app.use('/api/workspace', workspaceRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/patents', patentRoutes);
  app.use('/api/startup', startupRoutes);
  app.use('/api/investor', investorRoutes);
  app.use('/api/marketplace', marketplaceRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/startups', startupsInvestmentRouter);
  app.use('/api/recruiter', recruiterRoutes);
  app.use('/api/mentor', mentorRoutes);
  app.use('/api/school', schoolRoutes);
  app.use('/api/college', collegeRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/dm', dmRoutes);
  app.use('/api/report', reportRoutes);
  app.use('/api/settings', settingsRoutes);
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  if (hasClientBuild) {
    app.use(express.static(clientBuildPath));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  }

  app.use((_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
  });
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
