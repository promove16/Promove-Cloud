import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  getMarketplaceEntity,
  getMarketplaceUser,
  listMarketplaceUsers,
  normalizeMarketplaceEntityType,
} from './marketplace.service';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '../../types/roles.types';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getMarketplace = async (req: Request, res: Response) => {
  const role = normalizeMarketplaceEntityType(getParam(req.query.role as string | string[] | undefined));
  const fallbackRole = req.user!.role === UserRole.RECRUITER ? UserRole.STUDENT : UserRole.MENTOR;
  const users = await listMarketplaceUsers(
    req.user!.role,
    role ?? fallbackRole,
    typeof req.query.domain === 'string' ? req.query.domain : undefined,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 20),
  );
  res.json(new ApiResponse(users));
};

export const getMarketplaceEntityDetail = async (req: Request, res: Response) => {
  const entityType = normalizeMarketplaceEntityType(getParam(req.params.entityType));
  const entityId = getParam(req.params.entityId);

  if (!entityType || !entityId) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Marketplace entity type and id are required');
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
