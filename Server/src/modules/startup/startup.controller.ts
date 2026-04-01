import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  createStartupProfile,
  getMyStartup,
  launchSchema,
  launchStartup,
  requestStartupReview,
  startupSchema,
  updateStartupProfile,
  uploadPitchDeck,
} from './startup.service';
import { ApiError } from '../../utils/ApiError';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const createStartup = async (req: Request, res: Response) => {
  const startup = await createStartupProfile(req.user!._id, startupSchema.parse(req.body));
  res.status(201).json(new ApiResponse(startup));
};

export const getMyStartupController = async (req: Request, res: Response) => {
  const startup = await getMyStartup(req.user!._id);
  res.json(new ApiResponse(startup));
};

export const patchStartup = async (req: Request, res: Response) => {
  const startupId = getParam(req.params.id);
  if (!startupId) {
    throw new ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
  }
  const startup = await updateStartupProfile(startupId, req.user!._id, startupSchema.partial().parse(req.body));
  res.json(new ApiResponse(startup));
};

export const launchStartupController = async (req: Request, res: Response) => {
  const startupId = getParam(req.params.id);
  if (!startupId) {
    throw new ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
  }
  const startup = await launchStartup(startupId, req.user!._id, launchSchema.parse(req.body));
  res.json(new ApiResponse(startup));
};

export const requestStartupReviewController = async (req: Request, res: Response) => {
  const startupId = getParam(req.params.id);
  if (!startupId) {
    throw new ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
  }
  const startup = await requestStartupReview(startupId, req.user!._id);
  res.json(new ApiResponse(startup));
};

export const uploadPitchController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A pitch deck PDF is required');
  }
  const startupId = getParam(req.params.id);
  if (!startupId) {
    throw new ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
  }
  const startup = await uploadPitchDeck(startupId, req.user!._id, req.file);
  res.json(new ApiResponse(startup));
};
