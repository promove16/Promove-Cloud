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
  getCollegeHiringEvents,
} from './college.service';
import { createEventSchema } from '../event/event.service';
import { generateCollegeReport } from '../../services/complianceReport';
import { uploadFile } from '../../services/fileStorageService';
import { ApiError } from '../../utils/ApiError';
import { createInstitutionMentorshipProgramSchema } from '../mentor/mentor.validation';
import {
  createComplianceAction,
  createComplianceAlert,
  createComplianceIncident,
  getComplianceOverview,
  listComplianceActions,
  listComplianceAlerts,
  listComplianceIncidents,
  markComplianceAlertRead,
  updateComplianceAction,
  updateComplianceIncident,
} from '../institution/institutionCompliance.service';
import {
  getLatestInstitutionPolicySubmission,
  requestInstitutionPolicyEvidenceEdit,
  submitInstitutionPolicySubmission,
} from '../institution/institutionPolicySubmission.service';

const complianceEvidenceAllowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const complianceEvidenceMaxSizeBytes = 50 * 1024 * 1024;

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

export const listCollegeRecruitersController = async (req: Request, res: Response) => {
  const data = await getRecruiterDirectory(req.user!._id);
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
  const rankings = await getCollegeEventRankings(String(req.params.eventId), req.user!._id);
  res.status(200).json(
    new ApiResponse({
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      rankings,
    }),
  );
};

export const listCollegeHiringEventsController = async (req: Request, res: Response) => {
  const data = await getCollegeHiringEvents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeComplianceReportController = async (req: Request, res: Response) => {
  const reportUrl = await generateCollegeReport(req.user!._id);
  res.status(200).json(new ApiResponse({ reportUrl }));
};

export const getLatestCollegeComplianceReportController = async (req: Request, res: Response) => {
  const data = await getLatestCollegeComplianceReport(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getCollegeComplianceOverviewController = async (req: Request, res: Response) => {
  const data = await getComplianceOverview(req.user!._id, 'college');
  res.status(200).json(new ApiResponse(data));
};

export const getCollegeComplianceSubmissionController = async (req: Request, res: Response) => {
  const data = await getLatestInstitutionPolicySubmission(req.user!._id, 'college');
  res.status(200).json(new ApiResponse(data));
};

export const submitCollegeComplianceSubmissionController = async (req: Request, res: Response) => {
  const data = await submitInstitutionPolicySubmission(req.user!._id, 'college', req.user!._id, req.body);
  res.status(200).json(new ApiResponse(data));
};

export const requestCollegeComplianceEvidenceEditController = async (req: Request, res: Response) => {
  const data = await requestInstitutionPolicyEvidenceEdit(req.user!._id, 'college', req.user!._id, req.body);
  res.status(200).json(new ApiResponse(data));
};

export const uploadCollegeComplianceEvidenceController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A compliance evidence file is required.');
  }

  if (req.file.size > complianceEvidenceMaxSizeBytes) {
    throw new ApiError(400, 'FILE_TOO_LARGE', 'Compliance evidence files must be 50MB or smaller.');
  }

  if (!complianceEvidenceAllowedMimeTypes.has(req.file.mimetype)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Upload a PDF, image, document, spreadsheet, presentation, CSV, or text file.');
  }

  const upload = await uploadFile({
    buffer: req.file.buffer,
    folder: `compliance-evidence/college/${req.user!._id}`,
    fileName: req.file.originalname,
    contentType: req.file.mimetype,
  });

  res.status(201).json(
    new ApiResponse({
      url: upload.url,
      storageProvider: upload.provider,
      storageKey: upload.key,
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      contentType: req.file.mimetype,
    }),
  );
};

export const listCollegeComplianceIncidentsController = async (req: Request, res: Response) => {
  const data = await listComplianceIncidents(req.user!._id, 'college', req.query);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeComplianceIncidentController = async (req: Request, res: Response) => {
  const data = await createComplianceIncident(req.user!._id, 'college', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const updateCollegeComplianceIncidentController = async (req: Request, res: Response) => {
  const data = await updateComplianceIncident(
    req.user!._id,
    'college',
    String(req.params.incidentId),
    req.body,
  );
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeComplianceAlertsController = async (req: Request, res: Response) => {
  const data = await listComplianceAlerts(req.user!._id, 'college', req.query);
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeComplianceAlertController = async (req: Request, res: Response) => {
  const data = await createComplianceAlert(req.user!._id, 'college', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const markCollegeComplianceAlertReadController = async (req: Request, res: Response) => {
  const data = await markComplianceAlertRead(req.user!._id, 'college', String(req.params.alertId));
  res.status(200).json(new ApiResponse(data));
};

export const listCollegeComplianceActionsController = async (req: Request, res: Response) => {
  const data = await listComplianceActions(req.user!._id, 'college');
  res.status(200).json(new ApiResponse(data));
};

export const createCollegeComplianceActionController = async (req: Request, res: Response) => {
  const data = await createComplianceAction(req.user!._id, 'college', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const updateCollegeComplianceActionController = async (req: Request, res: Response) => {
  const data = await updateComplianceAction(
    req.user!._id,
    'college',
    String(req.params.actionId),
    req.body,
  );
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
