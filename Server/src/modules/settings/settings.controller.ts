import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getSettings, updateSettings } from './settings.service';

export const getMySettings = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const settings = await getSettings(String(req.user._id));
  res.status(200).json(new ApiResponse(settings));
};

export const updateMySettings = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const settings = await updateSettings(String(req.user._id), req.body);
  res.status(200).json(new ApiResponse(settings));
};
