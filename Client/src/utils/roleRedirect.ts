import { UserRole } from "../types/roles.types";

export const roleRedirect = (role: UserRole | "company"): string =>
  ({
    [UserRole.STUDENT]: "/dashboard/student",
    [UserRole.SCHOOL]: "/dashboard/school",
    [UserRole.COLLEGE]: "/dashboard/college",
    [UserRole.MENTOR]: "/dashboard/mentor",
    [UserRole.INVESTOR]: "/dashboard/investor",
    [UserRole.RECRUITER]: "/dashboard/recruiter",
    [UserRole.ADMIN]: "/dashboard/admin",
    company: "/dashboard/recruiter",
  })[role] ?? "/dashboard";
