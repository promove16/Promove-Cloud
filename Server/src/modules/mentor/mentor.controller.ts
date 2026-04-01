import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { createMentorSessionSchema, mentorSessionUpdateSchema } from './mentor.validation';
import {
  createMentorFeedback,
  createMentorSession,
  deleteMentorSession,
  getMentorDashboard,
  getMentorSession,
  getMentorStudentProfile,
  getMentorStudents,
  getMentorWorkspace,
  listMentorSessions,
  updateMentorSession,
} from './mentor.service';
import { createMentorFeedbackSchema } from './mentor.validation';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export const getMentorDashboardController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  res.status(200).json(new ApiResponse(await getMentorDashboard(req.user._id)));
};

export const listMentorStudentsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  res.status(200).json(new ApiResponse(await getMentorStudents(req.user._id)));
};

export const getMentorStudentProfileController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const studentId = getParam(req.params.id);
  if (!studentId || !isObjectId(studentId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getMentorStudentProfile(req.user._id, studentId)));
};

export const getMentorWorkspaceController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const studentId = getParam(req.params.id);
  const workspaceId = getParam(req.params.workspaceId);
  if (!studentId || !workspaceId || !isObjectId(studentId) || !isObjectId(workspaceId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  }
  res.status(200).json(new ApiResponse(await getMentorWorkspace(req.user._id, studentId, workspaceId)));
};

export const createMentorSessionController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const payload = createMentorSessionSchema.parse(req.body);
  res.status(201).json(new ApiResponse(await createMentorSession(req.user._id, payload)));
};

export const listMentorSessionsController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  res.status(200).json(new ApiResponse(await listMentorSessions(req.user._id)));
};

export const getMentorSessionController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const sessionId = getParam(req.params.id);
  if (!sessionId || !isObjectId(sessionId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getMentorSession(req.user._id, sessionId)));
};

export const updateMentorSessionController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const sessionId = getParam(req.params.id);
  if (!sessionId || !isObjectId(sessionId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = mentorSessionUpdateSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await updateMentorSession(req.user._id, sessionId, payload)));
};

export const deleteMentorSessionController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const sessionId = getParam(req.params.id);
  if (!sessionId || !isObjectId(sessionId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  await deleteMentorSession(req.user._id, sessionId);
  res.status(200).json(new ApiResponse({ updated: true }));
};

export const createMentorFeedbackController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const studentId = getParam(req.params.studentId);
  if (!studentId || !isObjectId(studentId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = createMentorFeedbackSchema.parse(req.body);
  res.status(201).json(
    new ApiResponse(
      await createMentorFeedback(req.user._id, {
        studentId,
        workspaceId: payload.workspaceId,
        feedbackText: payload.feedbackText,
        rating: payload.rating,
      }),
    ),
  );
};
