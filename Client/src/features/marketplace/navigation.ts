import { UserRole } from "../../types/roles.types";
import type { MarketplaceEntityType } from "../../api/marketplace.api";

const MARKETPLACE_ROLES = new Set<UserRole>([
  UserRole.STUDENT,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);

export const getMarketplaceBasePath = (role?: UserRole) => {
  if (role === UserRole.SCHOOL) {
    return "/dashboard/school";
  }
  const resolvedRole = role && MARKETPLACE_ROLES.has(role) ? role : UserRole.STUDENT;
  return `/dashboard/${resolvedRole}/marketplace`;
};

export const getStudentPortfolioViewPath = (userId: string) => `/portfolio/student/${userId}`;

export const getUserPortfolioViewPath = (
  entityType: Exclude<MarketplaceEntityType, "startup">,
  entityId: string,
) => (entityType === "student" ? getStudentPortfolioViewPath(entityId) : `/portfolio/view/${entityType}/${entityId}`);

export const getMarketplaceDetailPath = (
  role: UserRole | undefined,
  entityType: MarketplaceEntityType,
  entityId: string,
) =>
  entityType === "student"
    ? getStudentPortfolioViewPath(entityId)
    : `${getMarketplaceBasePath(role)}/view/${entityType}/${entityId}`;
