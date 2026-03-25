import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  getCurrentUser,
  getCurrentUserMentorSessions,
  launchCurrentUserToRecruiters,
  updateCurrentUser,
  updateMeSchema,
} from './user.service';

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const user = await getCurrentUser(req.user._id);
  res.status(200).json(new ApiResponse(user));
};

export const patchMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = updateMeSchema.parse(req.body);
  const user = await updateCurrentUser(req.user._id, payload);
  res.status(200).json(new ApiResponse(user));
};

export const getMySessions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const sessions = await getCurrentUserMentorSessions(req.user._id);
  res.status(200).json(new ApiResponse(sessions));
};

export const launchToRecruiters = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const result = await launchCurrentUserToRecruiters(req.user._id);
  res.status(200).json(new ApiResponse(result));
};
