import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  advanceDealStage,
  founderDecisionSchema,
  getDealForParticipant,
  getInvestorAuthorityPortfolio,
  getStartupCapTable,
  getStartupInvestors,
  listDealsForParticipant,
  recordFounderDecision,
  recordFundTransfer,
  updateInvestorRoleSchema,
  updateInvestmentRole,
} from './deal.service';

const objectIdSchema = /^[0-9a-fA-F]{24}$/;

const assertObjectId = (value: string, label: string) => {
  if (!objectIdSchema.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }

  return value;
};

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

export const fundTransferController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const deal = await recordFundTransfer(req.user._id, assertObjectId(String(req.params.id), 'Deal id'), req.body);
  res.status(200).json(new ApiResponse(deal));
};

export const updateDealStageController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const data = await advanceDealStage(req.user._id, assertObjectId(String(req.params.id), 'Deal id'), req.body);
  res.status(200).json(new ApiResponse(data));
};

export const respondToDealController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const deal = await recordFounderDecision(
    req.user._id,
    assertObjectId(String(req.params.id), 'Deal id'),
    founderDecisionSchema.parse(req.body),
  );
  res.status(200).json(new ApiResponse(deal));
};

export const getStartupInvestorsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const items = await getStartupInvestors(assertObjectId(String(req.params.id), 'Startup id'), req.user._id, req.user.role);
  res.status(200).json(new ApiResponse({ items }));
};

export const getStartupCapTableController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const capTable = await getStartupCapTable(assertObjectId(String(req.params.id), 'Startup id'), req.user._id, req.user.role);
  res.status(200).json(new ApiResponse(capTable));
};

export const getInvestorAuthorityController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const items = await getInvestorAuthorityPortfolio(req.user._id);
  res.status(200).json(new ApiResponse({ items }));
};

export const updateInvestorRoleController = async (req: Request, res: Response) => {
  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const payload = updateInvestorRoleSchema.parse(req.body);
  const deal = await updateInvestmentRole(dealId, payload.investorRole);
  res.status(200).json(new ApiResponse(deal));
};
