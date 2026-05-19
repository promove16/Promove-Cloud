import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  acknowledgeAgreement,
  getAgreement,
  getAgreementByBid,
  listAgreementsForUser,
} from './agreement.service';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

export const getAgreementController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const agreementId = assertObjectId(String(req.params.agreementId), 'Agreement ID');
  const a = await getAgreement(req.user._id, agreementId);
  res.json(new ApiResponse(a));
};

export const getAgreementByBidController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const bidId = assertObjectId(String(req.params.bidId), 'Bid ID');
  const a = await getAgreementByBid(req.user._id, bidId);
  res.json(new ApiResponse(a));
};

export const listAgreementsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const items = await listAgreementsForUser(req.user._id);
  res.json(new ApiResponse({ items }));
};

export const acknowledgeAgreementController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const agreementId = assertObjectId(String(req.params.agreementId), 'Agreement ID');
  const a = await acknowledgeAgreement(req.user._id, agreementId);
  res.json(new ApiResponse(a));
};
