import { UserRole } from "../types/roles.types";

export const roleRedirect = (role: UserRole | "company"): string =>
  ({
    [UserRole.STUDENT]: "/student",
    [UserRole.SCHOOL]: "/school",
    [UserRole.COLLEGE]: "/college",
    [UserRole.MENTOR]: "/mentor",
    [UserRole.INVESTOR]: "/investor",
    [UserRole.RECRUITER]: "/recruiter",
    [UserRole.ADMIN]: "/admin",
    company: "/recruiter",
  })[role] ?? "/dashboard";
