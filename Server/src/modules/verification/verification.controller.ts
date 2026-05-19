import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  verifyInvestor,
  verifyStartup,
  runFraudCheck,
  flagForFraud,
  clearFraudFlag,
  getPlatformVerificationStats,
} from './verification.service';

const investorDecisionSchema = z.enum(['verified', 'rejected']);
const startupDecisionSchema = z.enum(['approved', 'rejected']);
const fraudSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const verifyInvestorController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const investorId = req.params.investorId as string;
  const { decision, notes } = req.body;
  const result = await verifyInvestor(req.user._id, investorId, investorDecisionSchema.parse(decision), notes);
  res.json(new ApiResponse(result));
};

export const verifyStartupController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = req.params.startupId as string;
  const { decision, adminNotes } = req.body;
  const result = await verifyStartup(req.user._id, startupId, startupDecisionSchema.parse(decision), adminNotes);
  res.json(new ApiResponse(result));
};

export const checkFraudController = async (req: Request, res: Response) => {
  const startupId = req.params.startupId as string;
  const result = await runFraudCheck(startupId);
  res.json(new ApiResponse(result));
};

export const flagFraudController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = req.params.startupId as string;
  const { severity, description } = req.body;
  const result = await flagForFraud(
    req.user._id,
    startupId,
    fraudSeveritySchema.parse(severity),
    z.string().min(10).parse(description),
  );
  res.json(new ApiResponse(result));
};

export const clearFraudController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = req.params.startupId as string;
  const { flagType, note } = req.body;
  await clearFraudFlag(req.user._id, startupId, flagType, note);
  res.json(new ApiResponse({ cleared: true }));
};

export const getVerificationStatsController = async (_req: Request, res: Response) => {
  const stats = await getPlatformVerificationStats();
  res.json(new ApiResponse(stats));
};
