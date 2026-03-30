import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { getMyPatents, patentSubmissionSchema, submitPatent } from './patent.service';
import {
  getMyPatentRequests,
  getPatentRequestById,
  patentRequestSubmissionSchema,
  submitPatentRequest,
} from './patentRequest.service';

// ─── Self-filing ──────────────────────────────────────────────────────────────

export const createPatent = async (req: Request, res: Response) => {
  const patent = await submitPatent(req.user!._id, patentSubmissionSchema.parse(req.body));
  res.status(201).json(new ApiResponse(patent));
};

export const listMyPatents = async (req: Request, res: Response) => {
  const patents = await getMyPatents(req.user!._id);
  res.json(new ApiResponse(patents));
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
