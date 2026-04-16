import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  listPatentRequests,
  getPatentRequestDetail,
  updatePatentRequestStatus,
  assignPatentRequest,
  updateIpoDetails,
  addInternalNote,
  addTimelineEntry,
} from './patentRequestAdmin.service';
import {
  updateStatusSchema,
  assignRequestSchema,
  updateIpoDetailsSchema,
  addNoteSchema,
  addTimelineEntrySchema,
  listRequestsQuerySchema,
} from './patentRequestAdmin.validation';

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export const listPatentRequestsController = async (req: Request, res: Response) => {
  const query = listRequestsQuerySchema.parse(req.query);
  res.status(200).json(new ApiResponse(await listPatentRequests(query)));
};

export const getPatentRequestDetailController = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getPatentRequestDetail(id)));
};

export const updateStatusController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = updateStatusSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await updatePatentRequestStatus(req.user._id, id, payload)));
};

export const assignCaseController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = assignRequestSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await assignPatentRequest(req.user._id, id, payload)));
};

export const updateIpoDetailsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = updateIpoDetailsSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await updateIpoDetails(req.user._id, id, payload)));
};

export const addNoteController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = addNoteSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await addInternalNote(req.user._id, id, payload)));
};

export const addTimelineController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = addTimelineEntrySchema.parse(req.body);
  res.status(200).json(new ApiResponse(await addTimelineEntry(req.user._id, id, payload)));
};
