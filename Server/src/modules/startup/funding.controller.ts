import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getFundingSnapshot, recomputeStartupFunding } from './funding.service';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

export const getFundingSnapshotController = async (req: Request, res: Response) => {
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const snapshot = await getFundingSnapshot(startupId);
  if (!snapshot) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }
  res.json(new ApiResponse(snapshot));
};

export const recomputeFundingController = async (req: Request, res: Response) => {
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const snapshot = await recomputeStartupFunding(startupId);
  if (!snapshot) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }
  res.json(new ApiResponse(snapshot));
};
