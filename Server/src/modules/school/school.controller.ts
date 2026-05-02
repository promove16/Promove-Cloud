import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  cancelSchoolStudentRosterInvite,
  createSchoolEvent,
  createManagedStudentCredentialsSchema,
  createSchoolMentorshipProgramRequest,
  createSchoolManagedStudentCredentials,
  createSchoolStudentAccessToken,
  createSchoolStudentRosterEntry,
  createStudentAccessTokenSchema,
  getSchoolEventRankings,
  getInvestorDirectory,
  getLatestComplianceReport,
  getSchoolMentorshipPrograms,
  getSchoolPendingStudentVerifications,
  getSchoolStudentRoster,
  getSchoolStudentAccessTokens,
  getSchoolDashboard,
  getStudentJourney,
  getStudentLeaderboard,
  importSchoolStudentCredentials,
  importSchoolStudentRosterEntries,
  listSchoolEvents,
  listInstitutionPatents,
  listInstitutionProjects,
  listInstitutionStartups,
  listStudentRosterQuerySchema,
  manualStudentRosterEntrySchema,
  reviewSchoolStudentVerification,
  reviewStudentVerificationSchema,
} from './school.service';
import { createEventSchema } from '../event/event.service';
import { generateSchoolReport } from '../../services/complianceReport';
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

export const getSchoolDashboardController = async (req: Request, res: Response) => {
  const data = await getSchoolDashboard(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolStudentsController = async (req: Request, res: Response) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
  const data = await getStudentLeaderboard(req.user!._id, cursor, Number.isFinite(limit) ? limit : 50);
  res.status(200).json(new ApiResponse(data));
};

export const getSchoolStudentJourneyController = async (req: Request, res: Response) => {
  const data = await getStudentJourney(req.user!._id, String(req.params.id));
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolInvestorsController = async (_req: Request, res: Response) => {
  const data = await getInvestorDirectory();
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolProjectsController = async (req: Request, res: Response) => {
  const data = await listInstitutionProjects(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolPatentsController = async (req: Request, res: Response) => {
  const data = await listInstitutionPatents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolStartupsController = async (req: Request, res: Response) => {
  const data = await listInstitutionStartups(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolEventController = async (req: Request, res: Response) => {
  const payload = createEventSchema.parse(req.body);
  const data = await createSchoolEvent(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const listSchoolEventsController = async (req: Request, res: Response) => {
  const data = await listSchoolEvents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getSchoolEventRankingsController = async (req: Request, res: Response) => {
  const rankings = await getSchoolEventRankings(String(req.params.eventId), req.user!._id);
  res.status(200).json(
    new ApiResponse({
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      rankings,
    }),
  );
};

export const createSchoolComplianceReportController = async (req: Request, res: Response) => {
  const reportUrl = await generateSchoolReport(req.user!._id);
  res.status(200).json(new ApiResponse({ reportUrl }));
};

export const getLatestSchoolComplianceReportController = async (req: Request, res: Response) => {
  const data = await getLatestComplianceReport(req.user!._id, 'school');
  res.status(200).json(new ApiResponse(data));
};

export const getSchoolComplianceOverviewController = async (req: Request, res: Response) => {
  const data = await getComplianceOverview(req.user!._id, 'school');
  res.status(200).json(new ApiResponse(data));
};

export const getSchoolComplianceSubmissionController = async (req: Request, res: Response) => {
  const data = await getLatestInstitutionPolicySubmission(req.user!._id, 'school');
  res.status(200).json(new ApiResponse(data));
};

export const submitSchoolComplianceSubmissionController = async (req: Request, res: Response) => {
  const data = await submitInstitutionPolicySubmission(req.user!._id, 'school', req.user!._id, req.body);
  res.status(200).json(new ApiResponse(data));
};

export const requestSchoolComplianceEvidenceEditController = async (req: Request, res: Response) => {
  const data = await requestInstitutionPolicyEvidenceEdit(req.user!._id, 'school', req.user!._id, req.body);
  res.status(200).json(new ApiResponse(data));
};

export const uploadSchoolComplianceEvidenceController = async (req: Request, res: Response) => {
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
    folder: `compliance-evidence/school/${req.user!._id}`,
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

export const listSchoolComplianceIncidentsController = async (req: Request, res: Response) => {
  const data = await listComplianceIncidents(req.user!._id, 'school', req.query);
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolComplianceIncidentController = async (req: Request, res: Response) => {
  const data = await createComplianceIncident(req.user!._id, 'school', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const updateSchoolComplianceIncidentController = async (req: Request, res: Response) => {
  const data = await updateComplianceIncident(
    req.user!._id,
    'school',
    String(req.params.incidentId),
    req.body,
  );
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolComplianceAlertsController = async (req: Request, res: Response) => {
  const data = await listComplianceAlerts(req.user!._id, 'school', req.query);
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolComplianceAlertController = async (req: Request, res: Response) => {
  const data = await createComplianceAlert(req.user!._id, 'school', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const markSchoolComplianceAlertReadController = async (req: Request, res: Response) => {
  const data = await markComplianceAlertRead(req.user!._id, 'school', String(req.params.alertId));
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolComplianceActionsController = async (req: Request, res: Response) => {
  const data = await listComplianceActions(req.user!._id, 'school');
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolComplianceActionController = async (req: Request, res: Response) => {
  const data = await createComplianceAction(req.user!._id, 'school', req.user!._id, req.body);
  res.status(201).json(new ApiResponse(data));
};

export const updateSchoolComplianceActionController = async (req: Request, res: Response) => {
  const data = await updateComplianceAction(
    req.user!._id,
    'school',
    String(req.params.actionId),
    req.body,
  );
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolStudentAccessTokenController = async (req: Request, res: Response) => {
  const payload = createStudentAccessTokenSchema.parse(req.body);
  const data = await createSchoolStudentAccessToken(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const listSchoolStudentAccessTokensController = async (req: Request, res: Response) => {
  const data = await getSchoolStudentAccessTokens(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolPendingStudentVerificationsController = async (
  req: Request,
  res: Response,
) => {
  const data = await getSchoolPendingStudentVerifications(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const reviewSchoolStudentVerificationController = async (req: Request, res: Response) => {
  const payload = reviewStudentVerificationSchema.parse(req.body);
  const data = await reviewSchoolStudentVerification(
    req.user!._id,
    req.user!._id,
    String(req.params.studentId),
    payload,
  );
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolStudentRosterController = async (req: Request, res: Response) => {
  const { search } = listStudentRosterQuerySchema.parse(req.query);
  const data = await getSchoolStudentRoster(req.user!._id, search);
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolStudentRosterEntryController = async (req: Request, res: Response) => {
  const payload = manualStudentRosterEntrySchema.parse(req.body);
  const data = await createSchoolStudentRosterEntry(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const cancelSchoolStudentRosterInviteController = async (req: Request, res: Response) => {
  const data = await cancelSchoolStudentRosterInvite(req.user!._id, String(req.params.rosterEntryId));
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolManagedStudentCredentialsController = async (
  req: Request,
  res: Response,
) => {
  const payload = createManagedStudentCredentialsSchema.parse(req.body);
  const data = await createSchoolManagedStudentCredentials(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const importSchoolStudentRosterController = async (req: Request, res: Response) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'FILE_REQUIRED', 'An Excel or CSV file is required.');
  }

  const data = await importSchoolStudentRosterEntries(req.user!._id, req.user!._id, {
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });
  res.status(200).json(new ApiResponse(data));
};

export const importSchoolStudentCredentialsController = async (req: Request, res: Response) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'FILE_REQUIRED', 'An Excel or CSV file is required.');
  }

  const data = await importSchoolStudentCredentials(req.user!._id, req.user!._id, {
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });
  res.status(200).json(new ApiResponse(data));
};

export const listSchoolMentorshipProgramsController = async (req: Request, res: Response) => {
  const data = await getSchoolMentorshipPrograms(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createSchoolMentorshipProgramController = async (req: Request, res: Response) => {
  const payload = createInstitutionMentorshipProgramSchema.parse(req.body);
  const data = await createSchoolMentorshipProgramRequest(req.user!._id, req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};
