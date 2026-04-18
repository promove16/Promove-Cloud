import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { getMyPatents, getShowcasedPatents, patentSubmissionSchema, submitPatent, togglePatentShowcase } from './patent.service';
import {
  getMyPatentRequests,
  getPatentRequestById,
  patentRequestSubmissionSchema,
  patentRequestDocumentUploadSchema,
  submitPatentRequest,
  createPatentSupportRequest,
  deletePatentRequestDocument,
  patentSupportRequestSchema,
  uploadPatentRequestDocument,
  acknowledgeOfficialHandover,
} from './patentRequest.service';

export const createPatent = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const patent = await submitPatent(req.user._id, patentSubmissionSchema.parse(req.body));
  res.status(201).json(new ApiResponse(patent));
};

export const listMyPatents = async (req: Request, res: Response) => {
  const patents = await getMyPatents(req.user!._id);
  res.json(new ApiResponse(patents));
};

export const showcasePatent = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const result = await togglePatentShowcase(req.user._id, String(req.params.id));
  res.json(new ApiResponse(result));
};

export const listShowcasedPatents = async (_req: Request, res: Response) => {
  res.json(new ApiResponse(await getShowcasedPatents()));
};

// ─── Assisted filing ──────────────────────────────────────────────────────────

export const createPatentRequest = async (req: Request, res: Response) => {
  const request = await submitPatentRequest(req.user!._id, patentRequestSubmissionSchema.parse(req.body));
  res.status(201).json(new ApiResponse(request));
};

export const listMyPatentRequests = async (req: Request, res: Response) => {
  const requests = await getMyPatentRequests(req.user!._id);
  res.json(new ApiResponse(requests));
};

export const getPatentRequest = async (req: Request, res: Response) => {
  const request = await getPatentRequestById(req.user!._id, String(req.params.id));
  res.json(new ApiResponse(request));
};

export const uploadPatentRequestDocumentController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A patent workflow document is required.');
  }
  const request = await uploadPatentRequestDocument(
    req.user!._id,
    String(req.params.id),
    req.file,
    patentRequestDocumentUploadSchema.parse(req.body),
  );
  res.status(200).json(new ApiResponse(request));
};

export const deletePatentRequestDocumentController = async (req: Request, res: Response) => {
  const request = await deletePatentRequestDocument(req.user!._id, String(req.params.id), String(req.params.documentId));
  res.status(200).json(new ApiResponse(request));
};

export const acknowledgeOfficialHandoverController = async (req: Request, res: Response) => {
  const request = await acknowledgeOfficialHandover(req.user!._id, String(req.params.id));
  res.status(200).json(new ApiResponse(request));
};

// ─── Simple Patent Support Request ──────────────────────────────────────────

export const createSimplePatentSupportRequest = async (req: Request, res: Response) => {
  const request = await createPatentSupportRequest(req.user!._id, patentSupportRequestSchema.parse(req.body));
  res.status(201).json(new ApiResponse(request));
};
