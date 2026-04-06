import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  claimProblem,
  createAdminProblem,
  createProblemReviewRequestSchema,
  createProblemSchema,
  deleteAdminProblem,
  getProblemById,
  listProblemLeaderboard,
  listProblemReviewRequests,
  listProblemReviewRequestsQuerySchema,
  listAdminProblems,
  listProblems,
  requestProblemReview,
  reviewProblemSubmission,
  reviewProblemSubmissionSchema,
  updateAdminProblem,
  updateProblemSchema,
} from './problem.service';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getProblems = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const payload = await listProblems(req.query as Record<string, unknown>, req.user._id);
  res.json(new ApiResponse(payload.items, { total: payload.total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 10) }));
};

export const getProblem = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const problem = await getProblemById(problemId, req.user._id);
  res.json(new ApiResponse(problem));
};

export const claimProblemController = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const workspace = await claimProblem(problemId, req.user!._id);
  res.status(200).json(new ApiResponse(workspace));
};

export const requestProblemReviewController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const submission = await requestProblemReview(
    problemId,
    req.user._id,
    createProblemReviewRequestSchema.parse(req.body),
  );
  res.status(202).json(new ApiResponse(submission));
};

export const getProblemLeaderboardController = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  res.json(new ApiResponse(await listProblemLeaderboard(problemId)));
};

export const listAdminProblemsController = async (_req: Request, res: Response) => {
  res.json(new ApiResponse(await listAdminProblems()));
};

export const createAdminProblemController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const problem = await createAdminProblem(req.user._id, createProblemSchema.parse(req.body));
  res.status(201).json(new ApiResponse(problem));
};

export const updateAdminProblemController = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  const problem = await updateAdminProblem(problemId, updateProblemSchema.parse(req.body));
  res.status(200).json(new ApiResponse(problem));
};

export const deleteAdminProblemController = async (req: Request, res: Response) => {
  const problemId = getParam(req.params.id);
  if (!problemId) {
    throw new ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
  }
  res.status(200).json(new ApiResponse(await deleteAdminProblem(problemId)));
};

export const listProblemReviewRequestsController = async (req: Request, res: Response) => {
  const query = listProblemReviewRequestsQuerySchema.parse(req.query);
  res.json(new ApiResponse(await listProblemReviewRequests(query.status)));
};

export const reviewProblemSubmissionController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const submissionId = getParam(req.params.submissionId);
  if (!submissionId) {
    throw new ApiError(400, 'REVIEW_REQUEST_REQUIRED', 'Review request id is required');
  }
  res.status(200).json(
    new ApiResponse(
      await reviewProblemSubmission(
        req.user._id,
        submissionId,
        reviewProblemSubmissionSchema.parse(req.body),
      ),
    ),
  );
};
