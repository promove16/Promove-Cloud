import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { claimProblem, getProblemById, listProblems } from './problem.service';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getProblems = async (req: Request, res: Response) => {
  const payload = await listProblems(req.query as Record<string, unknown>);
  res.json(new ApiResponse(payload.items, { total: payload.total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 10) }));
};

export const getProblem = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const problem = await getProblemById(problemId);
  res.json(new ApiResponse(problem));
};

export const claimProblemController = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const workspace = await claimProblem(problemId, req.user!._id);
  res.status(201).json(new ApiResponse(workspace));
};
