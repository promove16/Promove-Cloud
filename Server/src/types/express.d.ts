import { UserRole } from './roles.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        email: string;
        role: UserRole;
        // Tenant context propagated from the JWT. For students this is the
        // institution they were enrolled under; for institution accounts
        // (school/college) this is their own _id; null for global roles
        // (admin/recruiter/investor/mentor that operate cross-tenant).
        institutionId: string | null;
      };
    }
  }
}

export {};
