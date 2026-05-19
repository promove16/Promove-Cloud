import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  getFounderAnalytics,
  getInvestorAnalytics,
  getAdminPlatformAnalytics,
  getStartupAnalytics,
} from './analytics.service';

export const founderAnalyticsController = async (req: Request, res: Response) => {
  if (!req.user) return;
  const data = await getFounderAnalytics(req.user._id);
  res.json(new ApiResponse(data));
};

export const founderStartupAnalyticsController = async (req: Request, res: Response) => {
  if (!req.user) return;
  const data = await getStartupAnalytics(req.user._id, req.params.startupId as string);
  res.json(new ApiResponse(data));
};

export const investorAnalyticsController = async (req: Request, res: Response) => {
  if (!req.user) return;
  const data = await getInvestorAnalytics(req.user._id);
  res.json(new ApiResponse(data));
};

export const adminPlatformAnalyticsController = async (_req: Request, res: Response) => {
  const data = await getAdminPlatformAnalytics();
  res.json(new ApiResponse(data));
};
