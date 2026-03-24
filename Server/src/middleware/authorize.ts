import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/roles.types';
import { ApiError } from '../utils/ApiError';

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have access to this resource'));
    }

    return next();
  };
