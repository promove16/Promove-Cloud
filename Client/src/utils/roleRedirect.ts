import { UserRole } from '../types/roles.types';

export const roleRedirect = (role: UserRole): string =>
  ({
    [UserRole.STUDENT]: '/dashboard/student',
    [UserRole.SCHOOL]: '/dashboard/school',
    [UserRole.COLLEGE]: '/dashboard/college',
    [UserRole.MENTOR]: '/dashboard/mentor',
    [UserRole.INVESTOR]: '/dashboard/investor',
    [UserRole.RECRUITER]: '/dashboard/recruiter',
    [UserRole.ADMIN]: '/dashboard/admin',
  })[role];
