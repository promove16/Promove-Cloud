import { UserRole } from './roles.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
