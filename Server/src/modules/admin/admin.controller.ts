import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { UserRole } from '../../types/roles.types';
import {
  createAdminInstitutionMentorshipProgramSchema,
  reviewInstitutionMentorshipProgramSchema,
} from '../mentor/mentor.validation';
import {
  analyticsLogsQuerySchema,
  analyticsUsersQuerySchema,
  awardRejectSchema,
  dealCancellationReviewSchema,
  createMentorProfileSchema,
  dealReviewSchema,
  listMentorshipProgramsQuerySchema,
  listRegistrationRequestsQuerySchema,
  listUsersQuerySchema,
  milestoneVerifySchema,
  patentRejectSchema,
  registrationRequestReviewSchema,
} from './admin.validation';
import {
  approveAward,
  getAdminCapTable,
  getDealAwaitingApproval,
  createAdminMentorshipProgram,
  createMentorProfile,
  getMentorDirectory,
  getMentorshipPrograms,
  approveDealStage,
  approvePatent,
  getAnalytics,
  getAnalyticsLogs,
  getAnalyticsUserDetail,
  getAnalyticsUsers,
  getInvestmentTypeBreakdown,
  listAwards,
  listDealsAwaitingApproval,
  listPatents,
  listRegistrationRequests,
  listUsers,
  deleteUser,
  reviewDeal,
  reviewDealCancellation,
  reviewRegistrationRequest,
  rejectAward,
  rejectPatent,
  resetStartupSoleInvestor,
  reviewMentorshipProgram,
  updateDealInvestorRole,
  updateUserAccess,
  updateUserRole,
  verifyMilestone,
} from './admin.service';
import { reviewPaymentApproval, reviewPaymentApprovalSchema } from '../deal/deal.service';
import {
  listAdminInstitutionPolicySubmissions,
  reviewInstitutionPolicySubmission,
} from '../institution/institutionPolicySubmission.service';
import * as startupService from '../startup/startup.service';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export const getUsersController = async (req: Request, res: Response) => {
  const query = listUsersQuerySchema.parse(req.query);
  const data = await listUsers({
    page: query.page,
    limit: query.limit,
    role: query.role,
    isActive: query.isActive,
  });
  res.status(200).json(new ApiResponse(data));
};

export const getRegistrationRequestsController = async (req: Request, res: Response) => {
  const query = listRegistrationRequestsQuerySchema.parse(req.query);
  const data = await listRegistrationRequests({
    status: query.status,
    role: query.role,
  });
  res.status(200).json(new ApiResponse(data));
};

export const getComplianceSubmissionsController = async (req: Request, res: Response) => {
  const data = await listAdminInstitutionPolicySubmissions(req.query);
  res.status(200).json(new ApiResponse(data));
};

export const reviewComplianceSubmissionController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const submissionId = getParam(req.params.id);
  if (!submissionId || !isObjectId(submissionId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  }

  const data = await reviewInstitutionPolicySubmission(submissionId, req.user._id, req.body);
  res.status(200).json(new ApiResponse(data));
};

export const updateUserRoleController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const role = req.body.role as UserRole;
  if (!Object.values(UserRole).includes(role)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Invalid role');
  }
  res.status(200).json(new ApiResponse(await updateUserRole(req.user._id, userId, role)));
};

export const updateUserAccessController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  if (typeof req.body?.isActive !== 'boolean') {
    throw new ApiError(400, 'INVALID_BODY', 'isActive must be a boolean');
  }
  res.status(200).json(new ApiResponse(await updateUserAccess(req.user._id, userId, req.body.isActive)));
};

export const deleteUserController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await deleteUser(req.user._id, userId)));
};

export const reviewRegistrationRequestController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = registrationRequestReviewSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await reviewRegistrationRequest(req.user._id, userId, payload)));
};

export const approveRegistrationRequestController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(
    new ApiResponse(
      await reviewRegistrationRequest(req.user._id, userId, { decision: 'approved' }),
    ),
  );
};

export const rejectRegistrationRequestController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const userId = getParam(req.params.id);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const rejectionReason =
    typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  if (!rejectionReason) {
    throw new ApiError(400, 'INVALID_BODY', 'rejectionReason is required');
  }

  res.status(200).json(
    new ApiResponse(
      await reviewRegistrationRequest(req.user._id, userId, {
        decision: 'rejected',
        reason: rejectionReason,
      }),
    ),
  );
};

export const getPatentsController = async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.status(200).json(new ApiResponse(await listPatents(status)));
};

export const approvePatentController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const patentId = getParam(req.params.id);
  if (!patentId || !isObjectId(patentId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const newScore = await approvePatent(req.user._id, patentId, 'PATENT_APPROVED');
  res.status(200).json(new ApiResponse({ approved: true, newScore }));
};

export const rejectPatentController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const patentId = getParam(req.params.id);
  if (!patentId || !isObjectId(patentId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const { adminNotes } = patentRejectSchema.parse(req.body);
  await rejectPatent(req.user._id, patentId, adminNotes);
  res.status(200).json(new ApiResponse({ rejected: true }));
};

export const getAwardsController = async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(await listAwards()));
};

export const approveAwardController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const awardId = getParam(req.params.id);
  if (!awardId || !isObjectId(awardId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  await approveAward(req.user._id, awardId);
  res.status(200).json(new ApiResponse({ approved: true }));
};

export const rejectAwardController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const awardId = getParam(req.params.id);
  if (!awardId || !isObjectId(awardId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const { adminNotes } = awardRejectSchema.parse(req.body);
  await rejectAward(req.user._id, awardId, adminNotes);
  res.status(200).json(new ApiResponse({ rejected: true }));
};

export const getDealsController = async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(await listDealsAwaitingApproval()));
};

export const getStartupReviewsController = async (req: Request, res: Response) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const allowedStatuses = new Set(['draft', 'review_requested', 'changes_requested', 'approved']);

  if (rawStatus && !allowedStatuses.has(rawStatus)) {
    throw new ApiError(400, 'INVALID_STATUS', 'Invalid startup review status');
  }

  const startups = await startupService.listStartupsForAdmin(
    rawStatus as 'draft' | 'review_requested' | 'changes_requested' | 'approved' | undefined,
  );
  res.status(200).json(new ApiResponse(startups));
};

export const reviewStartupController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const startupId = getParam(req.params.id);
  if (!startupId || !isObjectId(startupId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = startupService.reviewStartupSubmissionSchema.parse(req.body);
  const startup = await startupService.reviewStartupSubmission(req.user._id, startupId, payload);
  res.status(200).json(new ApiResponse(startup));
};

export const unlockLaunchFormController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const startupId = getParam(req.params.id);
  if (!startupId || !isObjectId(startupId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const { reason } = req.body as { reason?: string };
  const startup = await startupService.approveLaunchFormUnlock(req.user._id, startupId, { reason });
  res.status(200).json(new ApiResponse(startup));
};

export const getDealController = async (req: Request, res: Response) => {
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getDealAwaitingApproval(dealId)));
};

export const approveDealStageController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  await approveDealStage(req.user._id, dealId);
  res.status(200).json(new ApiResponse({ approved: true }));
};

export const reviewPaymentApprovalController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = reviewPaymentApprovalSchema.parse(req.body);
  const deal = await reviewPaymentApproval(req.user._id, dealId, payload);
  res.status(200).json(new ApiResponse(deal));
};

export const reviewDealController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = dealReviewSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await reviewDeal(req.user._id, dealId, payload)));
};

export const reviewDealCancellationController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = dealCancellationReviewSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await reviewDealCancellation(req.user._id, dealId, payload)));
};

export const updateDealInvestorRoleController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const dealId = getParam(req.params.id);
  if (!dealId || !isObjectId(dealId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const investorRole = req.body?.investorRole;
  if (!['shareholder', 'director', 'observer'].includes(investorRole)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Invalid investor role');
  }
  const data = await updateDealInvestorRole(req.user._id, dealId, investorRole);
  res.status(200).json(new ApiResponse(data));
};

export const getStartupCapTableController = async (req: Request, res: Response) => {
  const startupId = getParam(req.params.id);
  if (!startupId || !isObjectId(startupId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getAdminCapTable(startupId)));
};

export const resetSoleInvestorController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const startupId = getParam(req.params.id);
  if (!startupId || !isObjectId(startupId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await resetStartupSoleInvestor(req.user._id, startupId)));
};

export const getInvestmentTypeAnalyticsController = async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(await getInvestmentTypeBreakdown()));
};

export const getAnalyticsController = async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(await getAnalytics()));
};

export const getAnalyticsLogsController = async (req: Request, res: Response) => {
  const query = analyticsLogsQuerySchema.parse(req.query);
  res.status(200).json(new ApiResponse(await getAnalyticsLogs(query.limit)));
};

export const getAnalyticsUsersController = async (req: Request, res: Response) => {
  const query = analyticsUsersQuerySchema.parse(req.query);
  res.status(200).json(new ApiResponse(await getAnalyticsUsers(query.q, query.limit)));
};

export const getAnalyticsUserDetailController = async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  if (!userId || !isObjectId(userId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  res.status(200).json(new ApiResponse(await getAnalyticsUserDetail(userId)));
};

export const verifyMilestoneController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const milestoneId = getParam(req.params.id);
  if (!milestoneId || !isObjectId(milestoneId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const { milestoneType } = milestoneVerifySchema.parse(req.body);
  const newScore = await verifyMilestone(req.user._id, milestoneId, milestoneType);
  res.status(200).json(new ApiResponse({ verified: true, newScore }));
};

export const getMentorshipProgramsController = async (req: Request, res: Response) => {
  const query = listMentorshipProgramsQuerySchema.parse(req.query);
  res.status(200).json(new ApiResponse(await getMentorshipPrograms(query.status)));
};

export const getMentorsController = async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(await getMentorDirectory()));
};

export const createMentorProfileController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const payload = createMentorProfileSchema.parse(req.body);
  res.status(201).json(new ApiResponse(await createMentorProfile(req.user._id, payload)));
};

export const createAdminMentorshipProgramController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const payload = createAdminInstitutionMentorshipProgramSchema.parse(req.body);
  res.status(201).json(new ApiResponse(await createAdminMentorshipProgram(req.user._id, payload)));
};

export const reviewMentorshipProgramController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const programId = getParam(req.params.id);
  if (!programId || !isObjectId(programId)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = reviewInstitutionMentorshipProgramSchema.parse(req.body);
  res.status(200).json(new ApiResponse(await reviewMentorshipProgram(req.user._id, programId, payload)));
};
