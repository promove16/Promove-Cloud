import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getDealForParticipant } from '../deal/deal.service';
import {
  expressInterestSchema,
  expressInterest,
  getDashboard,
  getDeals,
  getInvestorAuthority,
  getInstitutions,
  getPortfolio,
  getStartup,
  getStartups,
  investorDealTransitionSchema,
  investAsSole,
  updateDealStage,
} from './investor.service';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const getInvestorDashboardController = async (req: Request, res: Response) => {
  const data = await getDashboard(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listInvestorStartupsController = async (req: Request, res: Response) => {
  const data = await getStartups(req.user!._id, {
    minScore: parseOptionalNumber(req.query.minScore),
    maxScore: parseOptionalNumber(req.query.maxScore),
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    stage: typeof req.query.stage === 'string' ? req.query.stage : undefined,
    page: parseOptionalNumber(req.query.page),
    limit: parseOptionalNumber(req.query.limit),
    acceptingPenny: req.query.acceptingPenny === 'true',
    acceptingSole: req.query.acceptingSole === 'true',
  });
  res.status(200).json(new ApiResponse(data));
};

export const getInvestorStartupController = async (req: Request, res: Response) => {
  const startupId = objectIdSchema.parse(req.params.id);
  const data = await getStartup(req.user!._id, startupId);
  res.status(200).json(new ApiResponse(data));
};

export const expressInterestController = async (req: Request, res: Response) => {
  const startupId = objectIdSchema.parse(req.params.startupId);
  const data = await expressInterest(req.user!._id, startupId, expressInterestSchema.parse(req.body));
  res.status(201).json(new ApiResponse(data));
};

export const expressSoleInterestController = async (req: Request, res: Response) => {
  const startupId = objectIdSchema.parse(req.params.id);
  const data = await investAsSole(req.user!._id, startupId, expressInterestSchema.parse(req.body));
  res.status(201).json(new ApiResponse(data));
};

export const listInvestorDealsController = async (req: Request, res: Response) => {
  const data = await getDeals(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getInvestorDealController = async (req: Request, res: Response) => {
  const dealId = objectIdSchema.parse(req.params.id);
  const deal = await getDealForParticipant(req.user!._id, req.user!.role, dealId);
  res.status(200).json(new ApiResponse(deal));
};

export const updateInvestorDealStageController = async (req: Request, res: Response) => {
  const dealId = objectIdSchema.parse(req.params.id);
  const payload = investorDealTransitionSchema.parse(req.body);
  const data = await updateDealStage(req.user!._id, dealId, payload);
  res.status(200).json(new ApiResponse(data));
};

export const listInvestorInstitutionsController = async (req: Request, res: Response) => {
  const type = z.enum(['school', 'college']).parse(req.query.type);
  const data = await getInstitutions(req.user!._id, type);
  res.status(200).json(new ApiResponse(data));
};

export const getInvestorPortfolioController = async (req: Request, res: Response) => {
  const data = await getPortfolio(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getInvestorAuthorityController = async (req: Request, res: Response) => {
  const data = await getInvestorAuthority(req.user!._id);
  res.status(200).json(new ApiResponse({ items: data }));
};
