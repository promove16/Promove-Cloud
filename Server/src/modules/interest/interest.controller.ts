import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  expressInterest,
  expressInterestSchema,
  getInvestorsForStartup,
  getMyInterests,
  getStartupInterestSummary,
  withdrawInterest,
} from './interest.service';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

export const expressInterestController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const interest = await expressInterest(req.user._id, startupId, expressInterestSchema.parse(req.body ?? {}));
  res.status(201).json(new ApiResponse(interest));
};

export const withdrawInterestController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const interest = await withdrawInterest(req.user._id, startupId);
  res.json(new ApiResponse(interest));
};

export const myInterestsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const items = await getMyInterests(req.user._id);
  res.json(new ApiResponse({ items }));
};

export const startupInterestSummaryController = async (req: Request, res: Response) => {
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const summary = await getStartupInterestSummary(startupId, req.user?._id);
  res.json(new ApiResponse(summary));
};

export const startupInterestedInvestorsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const items = await getInvestorsForStartup(startupId, req.user._id);
  res.json(new ApiResponse({ items }));
};
