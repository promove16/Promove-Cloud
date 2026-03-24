import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { getMarketplaceUser, listMarketplaceUsers } from './marketplace.service';
import { UserRole } from '../../types/roles.types';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getMarketplace = async (req: Request, res: Response) => {
  const role = getParam(req.query.role as string | string[] | undefined);
  const users = await listMarketplaceUsers(
    req.user!.role,
    (role as UserRole | undefined) ?? UserRole.MENTOR,
    typeof req.query.domain === 'string' ? req.query.domain : undefined,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 20),
  );
  res.json(new ApiResponse(users));
};

export const getMarketplaceProfile = async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  if (!userId) {
    throw new Error('User id is required');
  }
  const user = await getMarketplaceUser(req.user!.role, userId);
  res.json(new ApiResponse(user));
};
