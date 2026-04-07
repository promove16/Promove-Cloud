import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/roles.types';
import { ApiError } from '../utils/ApiError';

export const ALLOWED_CONNECTIONS: Record<UserRole, UserRole[]> = {
  [UserRole.STUDENT]: [UserRole.MENTOR, UserRole.INVESTOR, UserRole.RECRUITER],
  [UserRole.SCHOOL]: [UserRole.MENTOR, UserRole.INVESTOR],
  [UserRole.COLLEGE]: [
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
    UserRole.STUDENT,
  ],
  [UserRole.MENTOR]: [UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE],
  [UserRole.INVESTOR]: [UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE],
  [UserRole.RECRUITER]: [UserRole.STUDENT, UserRole.COLLEGE],
  [UserRole.ADMIN]: [
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
    UserRole.ADMIN,
  ],
};

export const connectionGuard =
  (targetRole: UserRole) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }

    const allowed = ALLOWED_CONNECTIONS[req.user.role] ?? [];

    if (!allowed.includes(targetRole)) {
      return next(
        new ApiError(
          403,
          'CONNECTION_FORBIDDEN',
          `Your role cannot connect with ${targetRole}`,
        ),
      );
    }

    return next();
  };
