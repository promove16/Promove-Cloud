import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  enrichCurrentUserFromSocialLinks,
  getCurrentUser,
  getCurrentUserMentorSessions,
  launchCurrentUserToRecruiters,
  socialEnrichSchema,
  updateCurrentUser,
  updateMeSchema,
} from './user.service';
import { User } from './user.model';

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

export const enrichMeFromSocialLinks = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = socialEnrichSchema.parse(req.body);
  const result = await enrichCurrentUserFromSocialLinks(req.user._id, payload);
  res.status(200).json(new ApiResponse(result));
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

export const searchUsers = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) {
    res.status(200).json(new ApiResponse([]));
    return;
  }

  // Escape regex special characters to prevent ReDoS
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const users = await User.find(
    {
      displayName: { $regex: escaped, $options: 'i' },
      isActive: true,
      _id: { $ne: req.user._id },
    },
    { _id: 1, displayName: 1, avatar: 1, role: 1 },
  )
    .limit(10)
    .lean();

  res.status(200).json(new ApiResponse(users));
};
