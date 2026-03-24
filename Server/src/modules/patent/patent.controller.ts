import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { getMyPatents, patentSubmissionSchema, submitPatent } from './patent.service';

export const createPatent = async (req: Request, res: Response) => {
  const patent = await submitPatent(req.user!._id, patentSubmissionSchema.parse(req.body));
  res.status(201).json(new ApiResponse(patent));
};

export const listMyPatents = async (req: Request, res: Response) => {
  const patents = await getMyPatents(req.user!._id);
  res.json(new ApiResponse(patents));
};
