import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getReputationForUser } from './reputation.service';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

export const getReputationController = async (req: Request, res: Response) => {
  const userId = assertObjectId(String(req.params.userId), 'User ID');
  const reputation = await getReputationForUser(userId);
  if (!reputation) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found or has no reputation');
  }
  res.json(new ApiResponse(reputation));
};

export const getMyReputationController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const reputation = await getReputationForUser(req.user._id);
  if (!reputation) {
    throw new ApiError(404, 'NO_REPUTATION', 'Reputation only available for investors and founders');
  }
  res.json(new ApiResponse(reputation));
};
