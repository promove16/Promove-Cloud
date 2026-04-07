import { UserRole } from "../../types/roles.types";
import type { MarketplaceEntityType } from "../../api/marketplace.api";

const MARKETPLACE_ROLES = new Set<UserRole>([
  UserRole.STUDENT,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);

export const getMarketplaceBasePath = (role?: UserRole) => {
  const resolvedRole = role && MARKETPLACE_ROLES.has(role) ? role : UserRole.STUDENT;
  return `/dashboard/${resolvedRole}/marketplace`;
};

export const getMarketplaceDetailPath = (
  role: UserRole | undefined,
  entityType: MarketplaceEntityType,
  entityId: string,
) => `${getMarketplaceBasePath(role)}/view/${entityType}/${entityId}`;
