import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../types/roles.types';
import { ApiError } from '../utils/ApiError';

interface AccessTokenPayload extends jwt.JwtPayload {
  _id: string;
  email: string;
  role: UserRole;
  // Tenant context. Optional in the type so that legacy access tokens issued
  // before this field was added still verify; we coalesce to null below.
  institutionId?: string | null;
  type: 'access';
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }

  const token = authorization.replace('Bearer ', '').trim();

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['RS256'],
    }) as AccessTokenPayload;

    req.user = {
      _id: decoded._id,
      email: decoded.email,
      role: decoded.role,
      institutionId: decoded.institutionId ?? null,
    };

    return next();
  } catch (_error) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};
