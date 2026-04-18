import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  createStartupProfile,
  deleteStartup,
  deleteStartupDocument,
  demoteFromCoFounder,
  getStartupById,
  getMyStartups,
  launchSchema,
  launchStartup,
  promoteToCoFounder,
  requestStartupReview,
  startupDocumentUploadSchema,
  startupSchema,
  updateStartupProfile,
  uploadPitchDeck,
  uploadStartupDocument,
  sendPitchRequest,
  respondToPitchRequest,
  getInvestorPitchRequests,
} from './startup.service';
import { ApiError } from '../../utils/ApiError';

const objectIdSchema = /^[0-9a-fA-F]{24}$/;

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getRequiredObjectIdParam = (
  value: string | string[] | undefined,
  requiredCode: string,
  requiredMessage: string,
) => {
  const param = getParam(value);

  if (!param) {
    throw new ApiError(400, requiredCode, requiredMessage);
  }

  if (!objectIdSchema.test(param)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  }

  return param;
};

export const createStartup = async (req: Request, res: Response) => {
  const startup = await createStartupProfile(req.user!._id, startupSchema.parse(req.body));
  res.status(201).json(new ApiResponse(startup));
};

export const getMyStartupsController = async (req: Request, res: Response) => {
  const startups = await getMyStartups(req.user!._id);
  res.json(new ApiResponse(startups));
};

export const getStartupByIdController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await getStartupById(startupId, req.user!._id);
  res.json(new ApiResponse(startup));
};

export const patchStartup = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await updateStartupProfile(startupId, req.user!._id, startupSchema.partial().parse(req.body));
  res.json(new ApiResponse(startup));
};

export const launchStartupController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await launchStartup(startupId, req.user!._id, launchSchema.parse(req.body));
  res.json(new ApiResponse(startup));
};

export const requestStartupReviewController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await requestStartupReview(startupId, req.user!._id);
  res.json(new ApiResponse(startup));
};

export const uploadPitchController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A pitch deck file is required');
  }
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await uploadPitchDeck(startupId, req.user!._id, req.file);
  res.json(new ApiResponse(startup));
};

export const uploadStartupDocumentController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'An IPR supporting document is required');
  }
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await uploadStartupDocument(
    startupId,
    req.user!._id,
    req.file,
    startupDocumentUploadSchema.parse(req.body),
  );
  res.json(new ApiResponse(startup));
};

export const promoteToCoFounderController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const memberId = getRequiredObjectIdParam(req.params.memberId, 'MEMBER_REQUIRED', 'Member id is required');
  const startup = await promoteToCoFounder(startupId, req.user!._id, memberId);
  res.json(new ApiResponse(startup));
};

export const demoteFromCoFounderController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const memberId = getRequiredObjectIdParam(req.params.memberId, 'MEMBER_REQUIRED', 'Member id is required');
  const startup = await demoteFromCoFounder(startupId, req.user!._id, memberId);
  res.json(new ApiResponse(startup));
};

export const deleteStartupController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  await deleteStartup(startupId, req.user!._id);
  res.json(new ApiResponse(null));
};

export const removeStartupDocumentController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const documentId = getRequiredObjectIdParam(
    req.params.documentId,
    'STARTUP_DOCUMENT_REQUIRED',
    'Startup document id is required',
  );
  const startup = await deleteStartupDocument(startupId, req.user!._id, documentId);
  res.json(new ApiResponse(startup));
};

export const sendPitchRequestController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const { investorId } = req.body;
  if (!investorId) {
    throw new ApiError(400, 'INVESTOR_REQUIRED', 'Investor ID is required');
  }
  const startup = await sendPitchRequest(startupId, req.user!._id, investorId);
  res.json(new ApiResponse(startup));
};

export const respondToPitchRequestController = async (req: Request, res: Response) => {
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const requestId = getRequiredObjectIdParam(req.params.requestId, 'REQUEST_REQUIRED', 'Pitch request id is required');
  const { decision, note } = req.body;
  if (!decision || !['accepted', 'rejected'].includes(decision)) {
    throw new ApiError(400, 'INVALID_DECISION', 'Decision must be accepted or rejected');
  }
  const startup = await respondToPitchRequest(startupId, req.user!._id, requestId, decision, note);
  res.json(new ApiResponse(startup));
};

export const getPitchRequestsController = async (req: Request, res: Response) => {
  const pitchRequests = await getInvestorPitchRequests(req.user!._id);
  res.json(new ApiResponse(pitchRequests));
};
