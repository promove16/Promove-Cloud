import cookieParser from 'cookie-parser';
import compression from 'compression';
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
import { userActivityMiddleware } from './middleware/userActivity';
import { httpMetricsMiddleware, metricsHandler } from './middleware/metrics';
import { healthHandler, readinessHandler } from './middleware/health';
import { backpressureMiddleware } from './middleware/backpressure';
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
import requestRoutes from './modules/request/request.routes';
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
import smartChatRoutes from './modules/smartChat/smartChat.routes';
import biddingRoutes from './modules/bidding/bidding.routes';
import interestRoutes from './modules/interest/interest.routes';
import agreementRoutes from './modules/agreement/agreement.routes';
import activityFeedRoutes from './modules/activityLog/activity.routes';
import reputationRoutes from './modules/reputation/reputation.routes';
import verificationRoutes from './modules/verification/verification.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import mentorScoreRoutes from './modules/mentorScore/mentorScore.routes';
import mentorScoreAdminRoutes from './modules/mentorScore/mentorScore.admin.routes';
import mentorResourceRoutes from './modules/mentorScore/mentorResource.routes';
import forumRoutes from './modules/mentorScore/forum.routes';
import { ApiError } from './utils/ApiError';

export const createApp = () => {
  const app = express();
  const clientBuildPath = path.resolve(__dirname, '../../public');
  const hasClientBuild = existsSync(clientBuildPath);
  const jsonBodyLimit = '256kb';

  app.set('trust proxy', 1);
  app.use(compression());
  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
  app.use(cookieParser());
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: httpLogStream,
    }),
  );
  app.use(httpMetricsMiddleware);
  app.use(userActivityMiddleware);

  // Operational endpoints outside /api so they bypass auth/rate limiting and
  // remain scrape-able regardless of API health.
  app.get('/metrics', metricsHandler);
  app.get('/health', healthHandler);
  app.get('/healthz', healthHandler);
  app.get('/readyz', readinessHandler);

  app.use('/api', backpressureMiddleware);
  app.use('/api', withRateLimit(apiLimiter));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/score', scoreRoutes);
  app.use('/api/problems', problemRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/workflow-requests', requestRoutes);
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
  app.use('/api/smart-chat', smartChatRoutes);
  app.use('/api/bids', biddingRoutes);
  app.use('/api/interests', interestRoutes);
  app.use('/api/agreements', agreementRoutes);
  app.use('/api/activity-feed', activityFeedRoutes);
  app.use('/api/reputation', reputationRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/mentor-score', mentorScoreRoutes);
  app.use('/api/admin/mentor-score', mentorScoreAdminRoutes);
  app.use('/api/mentor-resources', mentorResourceRoutes);
  app.use('/api/forum', forumRoutes);
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
