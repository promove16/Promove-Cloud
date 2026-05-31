import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  advanceDealStage,
  founderDecisionSchema,
  getDealContractData,
  getDealForParticipant,
  getInvestorAuthorityPortfolio,
  getStartupBidBoard,
  getStartupCapTable,
  getStartupInvestors,
  linkWorkshopSchema,
  listDealsForParticipant,
  placeBidFromUser,
  PlaceBidSchema,
  recordFounderDecision,
  recordFundTransfer,
  requestPaymentApproval,
  updateInvestorRoleSchema,
  updateInvestmentRole,
  linkWorkshopToDeal,
  unlinkWorkshopFromDeal,
  addNegotiationMessage,
  proposeNegotiationTerms,
  agreeNegotiationTerms,
  NegotiationTermsSchema,
  cancelDealByParticipant,
  cancelDealSchema,
} from './deal.service';
import { buildDealContractDocument, finalizeDealContract } from '../../services/dealContract';

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

export const downloadDealContractController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const data = await getDealContractData(
    req.user._id,
    req.user.role,
    assertObjectId(String(req.params.id), 'Deal id'),
  );

  const buffer = await finalizeDealContract(buildDealContractDocument(data));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${data.contractNumber}.pdf"`);
  res.status(200).send(buffer);
};

export const fundTransferController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const deal = await recordFundTransfer(req.user._id, assertObjectId(String(req.params.id), 'Deal id'), req.body);
  res.status(200).json(new ApiResponse(deal));
};

export const requestPaymentApprovalController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const deal = await requestPaymentApproval(req.user._id, assertObjectId(String(req.params.id), 'Deal id'));
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

export const linkWorkshopController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const payload = linkWorkshopSchema.parse(req.body);
  const result = await linkWorkshopToDeal(dealId, payload.workspaceId, String(req.user._id));
  res.status(200).json(new ApiResponse(result));
};

export const unlinkWorkshopController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const result = await unlinkWorkshopFromDeal(dealId, String(req.user._id));
  res.status(200).json(new ApiResponse(result));
};

export const addNegotiationMessageController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    throw new ApiError(400, 'INVALID_MESSAGE', 'Message is required');
  }

  const result = await addNegotiationMessage(dealId, String(req.user._id), message);
  res.status(200).json(new ApiResponse(result));
};

export const proposeNegotiationTermsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const { amountINR, equityPercent } = NegotiationTermsSchema.parse(req.body);

  const result = await proposeNegotiationTerms(dealId, String(req.user._id), amountINR, equityPercent);
  res.status(200).json(new ApiResponse(result));
};

export const agreeNegotiationTermsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');

  const result = await agreeNegotiationTerms(dealId, String(req.user._id));
  res.status(200).json(new ApiResponse(result));
};

export const cancelDealController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const dealId = assertObjectId(String(req.params.id), 'Deal id');
  const result = await cancelDealByParticipant(dealId, String(req.user._id), cancelDealSchema.parse(req.body ?? {}));
  res.status(200).json(new ApiResponse(result));
};

export const getStartupBidBoardController = async (req: Request, res: Response) => {
  const startupId = assertObjectId(String(req.params.id), 'Startup id');
  const viewerId = req.user ? String(req.user._id) : undefined;
  const board = await getStartupBidBoard(startupId, viewerId);
  res.status(200).json(new ApiResponse(board));
};

export const placeBidController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const startupId = assertObjectId(String(req.params.id), 'Startup id');
  const payload = PlaceBidSchema.parse(req.body);
  const deal = await placeBidFromUser(String(req.user._id), startupId, payload);
  res.status(201).json(new ApiResponse(deal));
};
