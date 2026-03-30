import { UserRole } from "../types/roles.types";

export const roleRedirect = (role: UserRole | "company"): string =>
  ({
    [UserRole.STUDENT]: "/student",
    [UserRole.SCHOOL]: "/school",
    [UserRole.COLLEGE]: "/college",
    [UserRole.MENTOR]: "/dashboard/mentor",
    [UserRole.INVESTOR]: "/dashboard/investor",
    [UserRole.RECRUITER]: "/recruiter",
    [UserRole.ADMIN]: "/dashboard/admin",
    company: "/recruiter",
  })[role] ?? "/dashboard";
