import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { getMarketplaceEntity, getMarketplaceUser, listMarketplaceUsers, MarketplaceEntityType } from './marketplace.service';
import { UserRole } from '../../types/roles.types';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizeMarketplaceEntityType = (
  value?: string,
): MarketplaceEntityType | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'hr' || normalized === 'hrs') {
    return UserRole.RECRUITER;
  }

  if (
    normalized === UserRole.MENTOR ||
    normalized === UserRole.INVESTOR ||
    normalized === UserRole.RECRUITER ||
    normalized === 'startup'
  ) {
    return normalized as MarketplaceEntityType;
  }

  throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
};

export const getMarketplace = async (req: Request, res: Response) => {
  const role = normalizeMarketplaceEntityType(getParam(req.query.role as string | string[] | undefined));
  const search =
    getParam(req.query.search as string | string[] | undefined) ??
    getParam(req.query.q as string | string[] | undefined) ??
    getParam(req.query.domain as string | string[] | undefined);

  const users = await listMarketplaceUsers(
    req.user!.role,
    role ?? UserRole.MENTOR,
    search,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 20),
  );
  res.json(new ApiResponse(users));
};

export const getMarketplaceEntityDetail = async (req: Request, res: Response) => {
  const entityType = normalizeMarketplaceEntityType(getParam(req.params.entityType));
  const entityId = getParam(req.params.entityId);

  if (!entityType || !entityId) {
    throw new Error('Marketplace entity type and id are required');
  }

  const entity = await getMarketplaceEntity(req.user!.role, entityType, entityId);
  res.json(new ApiResponse(entity));
};

export const getMarketplaceProfile = async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  if (!userId) {
    throw new Error('User id is required');
  }
  const user = await getMarketplaceUser(req.user!.role, userId);
  res.json(new ApiResponse(user));
};
