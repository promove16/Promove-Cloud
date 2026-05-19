import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  placeBid,
  placeBidSchema,
  counterBid,
  counterBidSchema,
  respondToBid,
  respondToBidSchema,
  getBidsForFounder,
  getBidsForInvestor,
  getBidById,
  getBidsForStartup,
  markBidAsViewed,
  expireStaleBids,
} from './bidding.service';
import { type BidStatus, type BidType } from './bidding.types';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

const parseOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const parseOptionalInt = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const placeBidController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const bid = await placeBid(req.user._id, startupId, placeBidSchema.parse(req.body));
  res.status(201).json(new ApiResponse(bid));
};

export const getFounderBidsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const filters = {
    status: parseOptionalString(req.query.status) as BidStatus | undefined,
    bidType: parseOptionalString(req.query.bidType) as BidType | undefined,
    sortBy: parseOptionalString(req.query.sortBy) as 'newest' | 'oldest' | 'amount_high' | 'amount_low' | undefined,
    page: parseOptionalInt(req.query.page),
    limit: parseOptionalInt(req.query.limit),
  };
  const result = await getBidsForFounder(req.user._id, filters);
  res.json(new ApiResponse(result));
};

export const getInvestorBidsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const filters = {
    status: parseOptionalString(req.query.status) as BidStatus | undefined,
    bidType: parseOptionalString(req.query.bidType) as BidType | undefined,
    sortBy: parseOptionalString(req.query.sortBy) as 'newest' | 'oldest' | 'amount_high' | 'amount_low' | undefined,
    page: parseOptionalInt(req.query.page),
    limit: parseOptionalInt(req.query.limit),
  };
  const result = await getBidsForInvestor(req.user._id, filters);
  res.json(new ApiResponse(result));
};

export const getBidController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const bidId = assertObjectId(String(req.params.bidId), 'Bid ID');
  const bid = await getBidById(req.user._id, bidId);
  res.json(new ApiResponse(bid));
};

export const getStartupBidsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const bids = await getBidsForStartup(startupId, req.user._id);
  res.json(new ApiResponse({ items: bids }));
};

export const markBidViewedController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const bidId = assertObjectId(String(req.params.bidId), 'Bid ID');
  const bid = await markBidAsViewed(req.user._id, bidId);
  res.json(new ApiResponse(bid));
};

export const counterBidController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const bidId = assertObjectId(String(req.params.bidId), 'Bid ID');
  const result = await counterBid(req.user._id, bidId, counterBidSchema.parse(req.body));
  res.json(new ApiResponse(result));
};

export const respondToBidController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const bidId = assertObjectId(String(req.params.bidId), 'Bid ID');
  const result = await respondToBid(req.user._id, bidId, respondToBidSchema.parse(req.body));
  res.json(new ApiResponse(result));
};

export const expireStaleBidsController = async (_req: Request, res: Response) => {
  const count = await expireStaleBids();
  res.json(new ApiResponse({ expiredCount: count }));
};
