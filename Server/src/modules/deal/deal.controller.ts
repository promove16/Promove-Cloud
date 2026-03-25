import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getDealForParticipant, listDealsForParticipant } from './deal.service';

export const getMyDealsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const items = await listDealsForParticipant(req.user._id, req.user.role);
  res.status(200).json(new ApiResponse({ items }));
};

export const getMyDealController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const deal = await getDealForParticipant(req.user._id, req.user.role, String(req.params.id));
  res.status(200).json(new ApiResponse(deal));
};

