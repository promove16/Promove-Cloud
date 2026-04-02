import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  createStartupProfile,
  deleteStartupDocument,
  getStartupById,
  getMyStartups,
  launchSchema,
  launchStartup,
  requestStartupReview,
  startupDocumentUploadSchema,
  startupSchema,
  updateStartupProfile,
  uploadPitchDeck,
  uploadStartupDocument,
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
    throw new ApiError(400, 'FILE_REQUIRED', 'A pitch deck PDF is required');
  }
  const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
  const startup = await uploadPitchDeck(startupId, req.user!._id, req.file);
  res.json(new ApiResponse(startup));
};

export const uploadStartupDocumentController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A startup registration document is required');
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
