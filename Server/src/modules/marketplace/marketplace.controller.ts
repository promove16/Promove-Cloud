import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { getMarketplaceEntity, getMarketplaceUser, listMarketplaceUsers, MarketplaceEntityType } from './marketplace.service';
import { UserRole } from '../../types/roles.types';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getMarketplace = async (req: Request, res: Response) => {
  const role = getParam(req.query.role as string | string[] | undefined);
  const users = await listMarketplaceUsers(
    req.user!.role,
    (role as MarketplaceEntityType | undefined) ?? UserRole.MENTOR,
    typeof req.query.domain === 'string' ? req.query.domain : undefined,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 20),
  );
  res.json(new ApiResponse(users));
};

export const getMarketplaceEntityDetail = async (req: Request, res: Response) => {
  const entityType = getParam(req.params.entityType) as MarketplaceEntityType | undefined;
  const entityId = getParam(req.params.entityId);

  if (!entityType || !entityId) {
    throw new Error('Marketplace entity type and id are required');
  }

  const entity = await getMarketplaceEntity(
    req.user!.role,
    entityType,
    entityId,
    String(req.user!._id),
  );
  res.json(new ApiResponse(entity));
};

export const getMarketplaceProfile = async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  if (!userId) {
    throw new Error('User id is required');
  }
  const user = await getMarketplaceUser(req.user!.role, userId, String(req.user!._id));
  res.json(new ApiResponse(user));
};
