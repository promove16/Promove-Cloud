import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  createSchoolStudentAccessToken,
  createStudentAccessTokenSchema,
  getInvestorDirectory,
  getLatestComplianceReport,
  getSchoolPendingStudentVerifications,
  getSchoolStudentAccessTokens,
  getSchoolDashboard,
  getStudentJourney,
  getStudentLeaderboard,
  reviewSchoolStudentVerification,
  reviewStudentVerificationSchema,
} from './school.service';
import { generateSchoolReport } from '../../services/complianceReport';

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

export const createSchoolComplianceReportController = async (req: Request, res: Response) => {
  const reportUrl = await generateSchoolReport(req.user!._id);
  res.status(200).json(new ApiResponse({ reportUrl }));
};

export const getLatestSchoolComplianceReportController = async (req: Request, res: Response) => {
  const data = await getLatestComplianceReport(req.user!._id, 'school');
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
