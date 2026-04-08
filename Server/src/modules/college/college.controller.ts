import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  cancelCollegeStudentRosterInvite,
  createCollegeMentorshipProgramRequest,
  createCollegeManagedStudentCredentials,
  createManagedStudentCredentialsSchema,
  createCollegeStudentAccessToken,
  createCollegeStudentRosterEntry,
  createStudentAccessTokenSchema,
  createCollegeEvent,
  getCollegePendingStudentVerifications,
  getCollegeStudentRoster,
  getCollegeStudentAccessTokens,
  getCollegeDashboard,
  getCollegeEventRankings,
  getCollegeInvestors,
  getCollegeMentorshipPrograms,
  getCollegePlacementTracker,
  getCollegeStudentJourney,
  getCollegeStudentLeaderboard,
  getLatestCollegeComplianceReport,
  getRecruiterDirectory,
  importCollegeStudentCredentials,
  importCollegeStudentRosterEntries,
  listStudentRosterQuerySchema,
  listCollegeEvents,
  getCollegePatents,
  getCollegeProjects,
  getCollegeStartups,
  manualStudentRosterEntrySchema,
  placementStatusSchema,
  reviewCollegeStudentVerification,
  reviewStudentVerificationSchema,
  updatePlacementStatus,
} from './college.service';
import { createEventSchema } from '../event/event.service';
import { generateCollegeReport } from '../../services/complianceReport';
import { ApiError } from '../../utils/ApiError';
import { createInstitutionMentorshipProgramSchema } from '../mentor/mentor.validation';

export const getCollegeDashboardController = async (req: Request, res: Response) => {
  const data = await getCollegeDashboard(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeStudentsController = async (req: Request, res: Response) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
  const data = await getCollegeStudentLeaderboard(
    req.user!._id,
    cursor,
    Number.isFinite(limit) ? limit : 50,
  );
  res.status(200).json(new ApiResponse(data));
};

export const getCollegeStudentJourneyController = async (req: Request, res: Response) => {
  const data = await getCollegeStudentJourney(req.user!._id, String(req.params.id));
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeInvestorsController = async (_req: Request, res: Response) => {
  const data = await getCollegeInvestors();
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeRecruitersController = async (_req: Request, res: Response) => {
  const data = await getRecruiterDirectory();
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeProjectsController = async (req: Request, res: Response) => {
  const data = await getCollegeProjects(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listCollegePatentsController = async (req: Request, res: Response) => {
  const data = await getCollegePatents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeStartupsController = async (req: Request, res: Response) => {
  const data = await getCollegeStartups(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getCollegePlacementController = async (req: Request, res: Response) => {
  const data = await getCollegePlacementTracker(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const updatePlacementStatusController = async (req: Request, res: Response) => {
  const payload = placementStatusSchema.parse(req.body);
  const data = await updatePlacementStatus(
    req.user!._id,
    String(req.params.studentId),
    payload.status,
  );
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeEventController = async (req: Request, res: Response) => {
  const payload = createEventSchema.parse(req.body);
  const data = await createCollegeEvent(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const listCollegeEventsController = async (req: Request, res: Response) => {
  const data = await listCollegeEvents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getCollegeEventRankingsController = async (req: Request, res: Response) => {
  const rankings = await getCollegeEventRankings(String(req.params.eventId), req.user!.institutionId);
  res.status(200).json(
    new ApiResponse({
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      rankings,
    }),
  );
};

export const createCollegeComplianceReportController = async (req: Request, res: Response) => {
  const reportUrl = await generateCollegeReport(req.user!._id);
  res.status(200).json(new ApiResponse({ reportUrl }));
};

export const getLatestCollegeComplianceReportController = async (req: Request, res: Response) => {
  const data = await getLatestCollegeComplianceReport(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeStudentAccessTokenController = async (req: Request, res: Response) => {
  const payload = createStudentAccessTokenSchema.parse(req.body);
  const data = await createCollegeStudentAccessToken(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const listCollegeStudentAccessTokensController = async (req: Request, res: Response) => {
  const data = await getCollegeStudentAccessTokens(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listCollegePendingStudentVerificationsController = async (
  req: Request,
  res: Response,
) => {
  const data = await getCollegePendingStudentVerifications(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const reviewCollegeStudentVerificationController = async (req: Request, res: Response) => {
  const payload = reviewStudentVerificationSchema.parse(req.body);
  const data = await reviewCollegeStudentVerification(
    req.user!._id,
    req.user!._id,
    String(req.params.studentId),
    payload,
  );
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeStudentRosterController = async (req: Request, res: Response) => {
  const { search } = listStudentRosterQuerySchema.parse(req.query);
  const data = await getCollegeStudentRoster(req.user!._id, search);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeStudentRosterEntryController = async (req: Request, res: Response) => {
  const payload = manualStudentRosterEntrySchema.parse(req.body);
  const data = await createCollegeStudentRosterEntry(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const cancelCollegeStudentRosterInviteController = async (req: Request, res: Response) => {
  const data = await cancelCollegeStudentRosterInvite(req.user!._id, String(req.params.rosterEntryId));
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeManagedStudentCredentialsController = async (
  req: Request,
  res: Response,
) => {
  const payload = createManagedStudentCredentialsSchema.parse(req.body);
  const data = await createCollegeManagedStudentCredentials(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const importCollegeStudentRosterController = async (req: Request, res: Response) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'FILE_REQUIRED', 'An Excel or CSV file is required.');
  }

  const data = await importCollegeStudentRosterEntries(req.user!._id, req.user!._id, {
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });
  res.status(200).json(new ApiResponse(data));
};

export const importCollegeStudentCredentialsController = async (req: Request, res: Response) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'FILE_REQUIRED', 'An Excel or CSV file is required.');
  }

  const data = await importCollegeStudentCredentials(req.user!._id, req.user!._id, {
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeMentorshipProgramsController = async (req: Request, res: Response) => {
  const data = await getCollegeMentorshipPrograms(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeMentorshipProgramController = async (req: Request, res: Response) => {
  const payload = createInstitutionMentorshipProgramSchema.parse(req.body);
  const data = await createCollegeMentorshipProgramRequest(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};
