import { NextFunction, Request, Response } from 'express';
import { logError } from '../config/logger';
import { recordApiRequestActivity } from '../modules/analytics/activity.service';

const excludedPrefixes = [
  '/api/health',
  '/api/users/me/activity',
  '/api/admin/analytics',
];

export const userActivityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const userId = req.user?._id;
    if (!userId) {
      return;
    }

    const path = req.originalUrl.split('?')[0];
    if (!path.startsWith('/api/')) {
      return;
    }

    if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) {
      return;
    }

    void recordApiRequestActivity({
      userId,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }).catch((error) => {
      logError('Failed to record API activity', error);
    });
  });

  next();
};
