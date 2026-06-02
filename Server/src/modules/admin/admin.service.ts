import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { open } from 'fs/promises';
import path from 'path';
import { ClientSession, Types } from 'mongoose';
import { logError } from '../../config/logger';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { applyScore, type ScoreTrigger } from '../../services/scoreEngine';
import { NotificationService } from '../notification/notification.service';
import { Patent } from '../patent/patent.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import {
  InstitutionRegulatoryBody,
  InstitutionVerificationDocumentCategory,
  RegistrationStage,
} from '../user/user.types';
import { assertInstitutionVerificationReadyForApproval } from '../institution/institutionVerification.service';
import {
  cancelStudentRosterInvite,
  createStudentRosterEntry as createInstitutionStudentRosterEntry,
  importStudentRosterEntries,
  listStudentRoster,
} from '../institution/studentRoster.service';
import {
  bulkCreateManagedStudentCredentials,
  createManagedStudentCredentials,
} from '../institution/institutionAccess.service';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { ScoreEvent } from '../innovationScore/score.model';
import { Deal } from '../deal/deal.model';
import {
  getInvestmentTypeAnalytics as getDealInvestmentTypeAnalytics,
  getStartupCapTable,
  invalidateInvestmentCaches,
  resetSoleInvestorForStartup,
  validateInvestmentTerms,
  updateInvestmentRole,
} from '../deal/deal.service';
import { AdminAuditLog } from './adminAuditLog.model';
import { AdminAward } from './award.model';
import { runMongoTransaction } from '../../utils/runMongoTransaction';
import {
  getPlatformUsageAnalytics,
  getUserActivityDetail,
  searchUserActivitySummaries,
} from '../analytics/activity.service';
import {
  AdminCreateMentorshipProgramPayload,
  AdminAnalyticsData,
  AdminAnalyticsLogEntry,
  AdminAwardItem,
  AdminDealItem,
  AdminDealReviewPayload,
  AdminDealReviewItem,
  AdminCreatedMentorProfile,
  AdminOnboardedAccount,
  AdminDealCancellationReviewPayload,
  AdminMentorListItem,
  AdminMentorshipProgramReviewPayload,
  AdminMentorshipProgramsResponse,
  AdminPatentItem,
  AdminRegistrationRequestItem,
  AdminStartupRecord,
  AdminUserActivityDetail,
  AdminUserListItem,
  AdminUserActivitySearchResponse,
  AdminUsersResponse,
} from './admin.types';
import {
  createAdminInstitutionMentorshipProgram,
  listAdminMentorshipPrograms,
  listAdminMentors,
  reviewInstitutionMentorshipProgram,
} from '../mentor/mentorshipProgram.service';

type AuditAction =
  | 'STARTUP_APPROVED'
  | 'STARTUP_CHANGES_REQUESTED'
  | 'PATENT_APPROVED'
  | 'PATENT_REJECTED'
  | 'AWARD_APPROVED'
  | 'AWARD_REJECTED'
  | 'MILESTONE_VERIFIED'
  | 'DEAL_STAGE_APPROVED'
  | 'REGISTRATION_REQUEST_APPROVED'
  | 'REGISTRATION_REQUEST_REJECTED'
  | 'SOLE_INVESTOR_RESET'
  | 'USER_ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'USER_DELETED'
  | 'DEAL_REJECTED'
  | 'DEAL_REVIEW_UPDATED'
  | 'MENTOR_PROFILE_CREATED'
  | 'ACCOUNT_ONBOARDED'
  | 'PROJECT_MENTOR_ASSIGNED'
  | 'PROJECT_MENTOR_UNASSIGNED'
  | 'MENTORSHIP_PROGRAM_CREATED'
  | 'MENTORSHIP_REQUEST_ASSIGNED'
  | 'MENTORSHIP_REQUEST_REJECTED'
  | 'PATENT_REQUEST_STATUS_UPDATED'
  | 'PATENT_REQUEST_ASSIGNED'
  | 'PATENT_REQUEST_IPO_DETAILS_UPDATED'
  | 'PATENT_REQUEST_NOTE_ADDED';

const NON_STUDENT_REGISTRATION_ROLES = new Set<UserRole>([
  UserRole.SCHOOL,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);
const MAX_ADMIN_CREDENTIALS = 3;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;
const ANALYTICS_CACHE_TTL_SECONDS = 60;
const ANALYTICS_LOG_CACHE_TTL_SECONDS = 15;
const APP_LOG_TAIL_LINE_LIMIT = 20;
const APP_LOG_READ_CHUNK_BYTES = 64 * 1024;
const appLogPath = path.resolve(__dirname, '../../../../logs/app.log');
const ansiEscapeSequence = /\u001b\[[0-9;]*m/g;
const DEFAULT_PROMOVE_ROYALTY_PERCENTAGE = 2.5;
const DEFAULT_SHARE_CLASS_LABEL = 'Common Equity';

const assertAdminCapacityAvailable = async () => {
  const adminCount = await User.countDocuments({ role: UserRole.ADMIN });

  if (adminCount >= MAX_ADMIN_CREDENTIALS) {
    throw new ApiError(
      409,
      'ADMIN_CREDENTIAL_LIMIT_REACHED',
      `Only ${MAX_ADMIN_CREDENTIALS} admin credentials are allowed.`,
    );
  }
};

const deriveApprovedRegistrationStage = (user: {
  role: UserRole;
  profileComplete: boolean;
  registrationStage?: string;
}): RegistrationStage => {
  if (user.role === UserRole.SCHOOL || user.role === UserRole.COLLEGE) {
    return 'complete' as const;
  }

  if (user.profileComplete) {
    return 'profile_setup' as const;
  }

  return user.registrationStage === 'institution_pending' || user.registrationStage === 'institution_verified'
    ? 'basic'
    : ((user.registrationStage as RegistrationStage | undefined) ?? 'basic');
};

const toIso = (value: Date | string) => new Date(value).toISOString();
const round = (value: number) => Number(value.toFixed(2));
const calculateRoyaltyAmount = (amountINR: number, royaltyPercentage: number) =>
  round((amountINR * royaltyPercentage) / 100);

const generateDealContractNumber = () => {
  const date = new Date();
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `PMV-CON-${yy}${mm}${dd}-${random}`;
};
type AdminInstitutionVerification = NonNullable<
  AdminRegistrationRequestItem['institutionVerification']
>;

const slugifyDisplayName = (displayName: string) => {
  const normalized = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'mentor';
};

const generateProfileSlug = async (displayName: string) => {
  const baseSlug = slugifyDisplayName(displayName);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomBytes(2).toString('hex');
    const candidate = `${baseSlug}-${suffix}`;
    const existing = await User.exists({ profileSlug: candidate });

    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'PROFILE_SLUG_GENERATION_FAILED', 'Unable to generate a unique profile URL');
};

const generateTemporaryPassword = () => randomBytes(6).toString('base64url');

const stripAnsi = (value: string) => value.replace(ansiEscapeSequence, '');

const countLines = (value: string) => value.split(/\r?\n/).filter((line) => line.trim().length > 0).length;

const readRecentLogLines = async (limit: number): Promise<string[]> => {
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    fileHandle = await open(appLogPath, 'r');
    const stat = await fileHandle.stat();

    if (stat.size === 0) {
      return [];
    }

    let offset = stat.size;
    let content = '';

    while (offset > 0 && countLines(content) <= limit) {
      const chunkSize = Math.min(APP_LOG_READ_CHUNK_BYTES, offset);
      offset -= chunkSize;

      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await fileHandle.read(buffer, 0, chunkSize, offset);
      content = buffer.toString('utf8', 0, bytesRead) + content;
    }

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-limit);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return [];
    }
    throw error;
  } finally {
    await fileHandle?.close();
  }
};

const parseApplicationLogLine = (
  line: string,
  index: number,
): AdminAnalyticsLogEntry => {
  const sanitizedLine = stripAnsi(line).trim();
  const matched = sanitizedLine.match(/^(?<timestamp>\S+)\s+\[(?<level>[^\]]+)\]\s*(?<message>.*)$/);
  const timestamp = matched?.groups?.timestamp;
  const level = matched?.groups?.level?.toLowerCase() ?? 'info';
  const message = matched?.groups?.message?.trim() || sanitizedLine;

  return {
    _id: `${timestamp ?? 'app-log'}-${index}`,
    level,
    message,
    source: /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s/i.test(message) ? 'http' : 'application',
    ...(timestamp ? { timestamp } : {}),
  };
};

const listRecentApplicationLogs = async (limit = APP_LOG_TAIL_LINE_LIMIT): Promise<AdminAnalyticsLogEntry[]> => {
  const recentLines = await readRecentLogLines(limit);
  return recentLines
    .map((line, index) => parseApplicationLogLine(line, index))
    .reverse();
};

const userListItem = (user: {
  _id: { toString(): string };
  displayName: string;
  email: string;
  role: UserRole;
  innovationScore: number;
  isActive: boolean;
  profileComplete: boolean;
  registrationStage: string;
  adminApprovalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  adminApprovalRequestedAt?: Date;
  adminApprovedAt?: Date;
  adminApprovalRejectedAt?: Date;
  adminApprovalRejectedReason?: string;
  accessGrantedBy: string;
  accessExpiresAt: Date;
  createdAt: Date;
}): AdminUserListItem => ({
  _id: user._id.toString(),
  displayName: user.displayName,
  email: user.email,
  role: user.role,
  innovationScore: user.innovationScore ?? 0,
  isActive: user.isActive,
  profileComplete: user.profileComplete,
  registrationStage: user.registrationStage,
  adminApprovalStatus: user.adminApprovalStatus,
  ...(user.adminApprovalRequestedAt
    ? { adminApprovalRequestedAt: toIso(user.adminApprovalRequestedAt) }
    : {}),
  ...(user.adminApprovedAt ? { adminApprovedAt: toIso(user.adminApprovedAt) } : {}),
  ...(user.adminApprovalRejectedAt
    ? { adminApprovalRejectedAt: toIso(user.adminApprovalRejectedAt) }
    : {}),
  ...(user.adminApprovalRejectedReason
    ? { adminApprovalRejectedReason: user.adminApprovalRejectedReason }
    : {}),
  accessGrantedBy: user.accessGrantedBy,
  accessExpiresAt: toIso(user.accessExpiresAt),
  createdAt: toIso(user.createdAt),
});

const registrationRequestItem = (user: {
  _id: { toString(): string };
  displayName: string;
  email: string;
  role: UserRole;
  adminApprovalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  createdAt: Date;
  adminApprovalRequestedAt?: Date;
  adminApprovedAt?: Date;
  adminApprovalRejectedAt?: Date;
  adminApprovalRejectedReason?: string;
  domain?: string;
  bio?: string;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating: number;
  };
  institutionVerification?: {
    regulatoryBodies: InstitutionRegulatoryBody[];
    affiliationName?: string;
    websiteUrl?: string;
    referenceCode?: string;
    notes?: string;
    documents: Array<{
      _id: Types.ObjectId;
      category: InstitutionVerificationDocumentCategory;
      fileUrl: string;
      fileType: 'pdf' | 'image' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'video' | 'audio' | 'other';
      fileName: string;
      fileSizeBytes: number;
      uploadedAt: Date;
      uploadedBy: Types.ObjectId;
    }>;
    readiness: {
      isReadyForReview: boolean;
      requiredDocumentCategories: InstitutionVerificationDocumentCategory[];
      uploadedDocumentCategories: InstitutionVerificationDocumentCategory[];
      missingItems: string[];
    };
  };
}): AdminRegistrationRequestItem => ({
  _id: user._id.toString(),
  displayName: user.displayName,
  email: user.email,
  role: user.role as AdminRegistrationRequestItem['role'],
  status: user.adminApprovalStatus as AdminRegistrationRequestItem['status'],
  isActive: user.isActive,
  createdAt: toIso(user.createdAt),
  requestedAt: toIso(user.adminApprovalRequestedAt ?? user.createdAt),
  ...(user.domain ? { domain: user.domain } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
  ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
  ...(user.institutionVerification
    ? {
        institutionVerification: {
          regulatoryBodies: user.institutionVerification.regulatoryBodies ?? [],
          ...(user.institutionVerification.affiliationName
            ? { affiliationName: user.institutionVerification.affiliationName }
            : {}),
          ...(user.institutionVerification.websiteUrl
            ? { websiteUrl: user.institutionVerification.websiteUrl }
            : {}),
          ...(user.institutionVerification.referenceCode
            ? { referenceCode: user.institutionVerification.referenceCode }
            : {}),
          ...(user.institutionVerification.notes
            ? { notes: user.institutionVerification.notes }
            : {}),
          documents: (user.institutionVerification.documents ?? []).map((document) => ({
            _id: document._id.toString(),
            category: document.category as AdminInstitutionVerification['documents'][number]['category'],
            fileUrl: document.fileUrl,
            fileType: document.fileType,
            fileName: document.fileName,
            fileSizeBytes: document.fileSizeBytes,
            uploadedAt: toIso(document.uploadedAt),
            uploadedBy: document.uploadedBy.toString(),
          })),
          readiness: {
            isReadyForReview: user.institutionVerification.readiness?.isReadyForReview ?? false,
            requiredDocumentCategories:
              user.institutionVerification.readiness?.requiredDocumentCategories ?? [],
            uploadedDocumentCategories:
              user.institutionVerification.readiness?.uploadedDocumentCategories ?? [],
            missingItems: user.institutionVerification.readiness?.missingItems ?? [],
          },
        },
      }
    : {}),
  ...(user.adminApprovedAt ? { reviewedAt: toIso(user.adminApprovedAt) } : {}),
  ...(user.adminApprovalRejectedAt ? { reviewedAt: toIso(user.adminApprovalRejectedAt) } : {}),
  ...(user.adminApprovalRejectedReason
    ? { rejectionReason: user.adminApprovalRejectedReason }
    : {}),
});

const pushNotification = async (
  userId: string,
  type: Parameters<typeof NotificationService.create>[0]['type'],
  title: string,
  body: string,
  link = '/dashboard/admin',
) => {
  const notification = await NotificationService.create({
    userId,
    type,
    title,
    body,
    link,
  });

  if (io) {
    io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  }
};

const createAudit = (
  adminId: string,
  action: AuditAction,
  targetId: string,
  targetModel: string,
  metadata?: Record<string, unknown>,
  session?: ClientSession,
) =>
  AdminAuditLog.create(
    [
      {
        adminId,
        action,
        targetId,
        targetModel,
        ...(metadata ? { metadata } : {}),
      },
    ],
    session ? { session } : undefined,
  );

const getAdminStockDetails = (deal: {
  amountINR?: number;
  sharesAllocated?: number;
  stockDetails?: {
    shareClassLabel?: string;
    sharePriceInr?: number;
    transferValueInr?: number;
    totalSharesConsidered?: number;
  };
}) => ({
  shareClassLabel: deal.stockDetails?.shareClassLabel ?? DEFAULT_SHARE_CLASS_LABEL,
  sharePriceInr:
    deal.stockDetails?.sharePriceInr ??
    ((deal.sharesAllocated ?? 0) > 0 && typeof deal.amountINR === 'number'
      ? round(deal.amountINR / (deal.sharesAllocated ?? 1))
      : 0),
  transferValueInr: deal.stockDetails?.transferValueInr ?? deal.amountINR ?? 0,
  totalSharesConsidered: deal.stockDetails?.totalSharesConsidered ?? deal.sharesAllocated ?? 0,
});

const getAdminStockTransfer = (deal: {
  stage: number;
  stockTransfer?: {
    status?: 'not_started' | 'pending_review' | 'under_review' | 'approved' | 'rejected';
    requestedAt?: Date | null;
    requestedByRole?: 'investor' | 'student' | 'admin';
    requestSummary?: string;
    reviewNotes?: string;
    reviewedAt?: Date | null;
    reviewedBy?: Types.ObjectId;
  };
}) => ({
  status: deal.stockTransfer?.status ?? (deal.stage >= 3 ? 'pending_review' : 'not_started'),
  ...(deal.stockTransfer?.requestedAt ? { requestedAt: toIso(deal.stockTransfer.requestedAt) } : {}),
  ...(deal.stockTransfer?.requestedByRole ? { requestedByRole: deal.stockTransfer.requestedByRole } : {}),
  ...(deal.stockTransfer?.requestSummary ? { requestSummary: deal.stockTransfer.requestSummary } : {}),
  ...(deal.stockTransfer?.reviewNotes ? { reviewNotes: deal.stockTransfer.reviewNotes } : {}),
  ...(deal.stockTransfer?.reviewedAt ? { reviewedAt: toIso(deal.stockTransfer.reviewedAt) } : {}),
  ...(deal.stockTransfer?.reviewedBy ? { reviewedBy: String(deal.stockTransfer.reviewedBy) } : {}),
});

const getAdminRoyalty = (deal: {
  amountINR?: number;
  royalty?: {
    promovePercentage?: number;
    promoveAmountINR?: number;
    status?: 'pending' | 'invoiced' | 'received';
    settledAt?: Date | null;
  };
}) => {
  const promovePercentage = deal.royalty?.promovePercentage ?? DEFAULT_PROMOVE_ROYALTY_PERCENTAGE;

  return {
    promovePercentage,
    promoveAmountINR:
      deal.royalty?.promoveAmountINR ?? calculateRoyaltyAmount(deal.amountINR ?? 0, promovePercentage),
    status: deal.royalty?.status ?? 'pending',
    ...(deal.royalty?.settledAt ? { settledAt: toIso(deal.royalty.settledAt) } : {}),
  };
};

const getAdminCancellationRequest = (deal: {
  cancellationRequest?: {
    status?: 'pending' | 'approved' | 'rejected';
    reason?: string;
    requestedBy?: Types.ObjectId;
    requestedByRole?: 'investor' | 'student';
    requestedAt?: Date | null;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date | null;
    reviewNotes?: string;
  };
}) => {
  const request = deal.cancellationRequest;
  if (!request?.status) {
    return undefined;
  }

  return {
    status: request.status,
    ...(request.reason ? { reason: request.reason } : {}),
    ...(request.requestedBy ? { requestedBy: String(request.requestedBy) } : {}),
    ...(request.requestedByRole ? { requestedByRole: request.requestedByRole } : {}),
    ...(request.requestedAt ? { requestedAt: toIso(request.requestedAt) } : {}),
    ...(request.reviewedBy ? { reviewedBy: String(request.reviewedBy) } : {}),
    ...(request.reviewedAt ? { reviewedAt: toIso(request.reviewedAt) } : {}),
    ...(request.reviewNotes ? { reviewNotes: request.reviewNotes } : {}),
  };
};

const getAdminPaymentApproval = (deal: {
  paymentApproval?: {
    status?: 'none' | 'requested' | 'approved' | 'rejected';
    requestedAt?: Date | null;
    requestedBy?: Types.ObjectId;
    reviewedAt?: Date | null;
    reviewedBy?: Types.ObjectId;
    reviewNotes?: string;
  };
}) => {
  const approval = deal.paymentApproval;
  if (!approval?.status || approval.status === 'none') {
    return undefined;
  }

  return {
    status: approval.status,
    ...(approval.requestedAt ? { requestedAt: toIso(approval.requestedAt) } : {}),
    ...(approval.requestedBy ? { requestedBy: String(approval.requestedBy) } : {}),
    ...(approval.reviewedAt ? { reviewedAt: toIso(approval.reviewedAt) } : {}),
    ...(approval.reviewedBy ? { reviewedBy: String(approval.reviewedBy) } : {}),
    ...(approval.reviewNotes ? { reviewNotes: approval.reviewNotes } : {}),
  };
};

const buildAdminDealItem = (
  deal: {
    _id: Types.ObjectId;
    investorId: Types.ObjectId;
    startupId: Types.ObjectId;
    studentId: Types.ObjectId;
    mediatorLabel?: string;
    requestOrigin?: 'investor' | 'student';
    mediationStatus?: 'intake' | 'under_review' | 'approved' | 'rejected';
    investorType: 'penny' | 'sole';
    stage: number;
    amountINR?: number;
    equityPercent?: number;
    investorRole?: 'shareholder' | 'director' | 'observer';
    sharesAllocated?: number;
    votingWeight?: number;
    canVeto?: boolean;
    adminApprovalRequired: boolean;
    adminApprovedAt?: Date | null;
    adminApprovedBy?: Types.ObjectId;
    stockDetails?: {
      shareClassLabel?: string;
      sharePriceInr?: number;
      transferValueInr?: number;
      totalSharesConsidered?: number;
    };
    stockTransfer?: {
      status?: 'not_started' | 'pending_review' | 'under_review' | 'approved' | 'rejected';
      requestedAt?: Date | null;
      requestedByRole?: 'investor' | 'student' | 'admin';
      requestSummary?: string;
      reviewNotes?: string;
      reviewedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
    };
    royalty?: {
      promovePercentage?: number;
      promoveAmountINR?: number;
      status?: 'pending' | 'invoiced' | 'received';
      settledAt?: Date | null;
    };
    cancellationRequest?: {
      status?: 'pending' | 'approved' | 'rejected';
      reason?: string;
      requestedBy?: Types.ObjectId;
      requestedByRole?: 'investor' | 'student';
      requestedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
      reviewedAt?: Date | null;
      reviewNotes?: string;
    };
    paymentApproval?: {
      status?: 'none' | 'requested' | 'approved' | 'rejected';
      requestedAt?: Date | null;
      requestedBy?: Types.ObjectId;
      reviewedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
      reviewNotes?: string;
    };
    innovationScoreSnapshot: number;
    status: 'active' | 'closed' | 'cancelled';
  },
  investorName: string,
  startupName: string,
  studentName: string,
): AdminDealItem => ({
  _id: String(deal._id),
  investorId: String(deal.investorId),
  startupId: String(deal.startupId),
  studentId: String(deal.studentId),
  mediatorLabel: deal.mediatorLabel ?? 'ProMove',
  requestOrigin: deal.requestOrigin ?? 'investor',
  mediationStatus: deal.mediationStatus ?? (deal.stage >= 3 ? 'under_review' : 'intake'),
  investorType: deal.investorType,
  stage: deal.stage as 0 | 1 | 2 | 3 | 4,
  ...(deal.amountINR ? { amountINR: deal.amountINR } : {}),
  ...(deal.equityPercent ? { equityPercent: deal.equityPercent } : {}),
  ...(deal.investorRole ? { investorRole: deal.investorRole } : {}),
  ...(deal.sharesAllocated !== undefined ? { sharesAllocated: deal.sharesAllocated } : {}),
  ...(deal.votingWeight !== undefined ? { votingWeight: deal.votingWeight } : {}),
  ...(deal.canVeto !== undefined ? { canVeto: deal.canVeto } : {}),
  adminApprovalRequired: deal.adminApprovalRequired,
  ...(deal.adminApprovedAt ? { adminApprovedAt: toIso(deal.adminApprovedAt) } : {}),
  ...(deal.adminApprovedBy ? { adminApprovedBy: String(deal.adminApprovedBy) } : {}),
  stockDetails: getAdminStockDetails(deal),
  stockTransfer: getAdminStockTransfer(deal),
  royalty: getAdminRoyalty(deal),
  ...(getAdminCancellationRequest(deal) ? { cancellationRequest: getAdminCancellationRequest(deal) } : {}),
  ...(getAdminPaymentApproval(deal) ? { paymentApproval: getAdminPaymentApproval(deal) } : {}),
  innovationScoreSnapshot: deal.innovationScoreSnapshot,
  status: deal.status,
  nextActionLabel:
    deal.cancellationRequest?.status === 'pending'
      ? 'Review cancellation request'
      : deal.paymentApproval?.status === 'requested'
      ? 'Review payment approval request'
      : deal.stage < 3
      ? 'Waiting for stock transfer request'
      : deal.stockTransfer?.status === 'rejected'
        ? 'Transfer rejected - awaiting resubmission'
      : deal.adminApprovedAt
        ? 'Transfer verified by ProMove'
        : 'Review stock transfer',
  investorName,
  startupName,
  studentName,
});

const buildAdminDealReviewItem = (
  deal: {
    _id: Types.ObjectId;
    investorId: Types.ObjectId;
    startupId: Types.ObjectId;
    studentId: Types.ObjectId;
    mediatorLabel?: string;
    requestOrigin?: 'investor' | 'student';
    mediationStatus?: 'intake' | 'under_review' | 'approved' | 'rejected';
    investorType: 'penny' | 'sole';
    stage: number;
    amountINR?: number;
    equityPercent?: number;
    investorRole?: 'shareholder' | 'director' | 'observer';
    sharesAllocated?: number;
    votingWeight?: number;
    canVeto?: boolean;
    adminApprovalRequired: boolean;
    adminApprovedAt?: Date | null;
    adminApprovedBy?: Types.ObjectId;
    stockDetails?: {
      shareClassLabel?: string;
      sharePriceInr?: number;
      transferValueInr?: number;
      totalSharesConsidered?: number;
    };
    stockTransfer?: {
      status?: 'not_started' | 'pending_review' | 'under_review' | 'approved' | 'rejected';
      requestedAt?: Date | null;
      requestedByRole?: 'investor' | 'student' | 'admin';
      requestSummary?: string;
      reviewNotes?: string;
      reviewedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
    };
    royalty?: {
      promovePercentage?: number;
      promoveAmountINR?: number;
      status?: 'pending' | 'invoiced' | 'received';
      settledAt?: Date | null;
    };
    cancellationRequest?: {
      status?: 'pending' | 'approved' | 'rejected';
      reason?: string;
      requestedBy?: Types.ObjectId;
      requestedByRole?: 'investor' | 'student';
      requestedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
      reviewedAt?: Date | null;
      reviewNotes?: string;
    };
    paymentApproval?: {
      status?: 'none' | 'requested' | 'approved' | 'rejected';
      requestedAt?: Date | null;
      requestedBy?: Types.ObjectId;
      reviewedAt?: Date | null;
      reviewedBy?: Types.ObjectId;
      reviewNotes?: string;
    };
    innovationScoreSnapshot: number;
    status: 'active' | 'closed' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
    fundTransferInitiatedAt?: Date | null;
    closedAt?: Date | null;
  },
  startup: {
    _id: Types.ObjectId;
    name: string;
    tagline?: string;
    category: string;
    stage: string;
    pitchDeckUrl?: string;
    pitchDeckName?: string;
    projectId?: Types.ObjectId;
    founderIds: Types.ObjectId[];
    teamSize?: number;
    fundingNeeded?: number;
    activeProducts?: number;
    launchedAt?: Date;
    innovationScoreAtLaunch?: number;
    totalShares?: number;
    availableShares?: number;
    reservedForSole?: number;
    maxPennyInvestors?: number;
    currentPennyCount?: number;
    hasSoleInvestor?: boolean;
    traction?: {
      patentFiled?: boolean;
      mvpBuilt?: boolean;
      revenueGenerating?: boolean;
      usersCount?: number;
    };
  } | null,
  student: {
    _id: Types.ObjectId;
    displayName: string;
    avatar?: string;
    role: UserRole;
    innovationScore: number;
  } | null,
  investor: {
    _id: Types.ObjectId;
    displayName: string;
    avatar?: string;
    role: UserRole;
    innovationScore: number;
  } | null,
  founders: Array<{
    _id: Types.ObjectId;
    displayName: string;
    avatar?: string;
    innovationScore?: number;
    scoreBreakdown?: Record<string, number>;
    domain?: string;
  }>,
  scoreEvents: Array<{
    _id: Types.ObjectId;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: Date;
  }>,
  workspace: {
    _id: Types.ObjectId;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    milestones: Array<{
      _id: Types.ObjectId;
      name: string;
      isCompleted: boolean;
      completionPercent: number;
      completedAt?: Date;
    }>;
    uploads: Array<{
      _id: Types.ObjectId;
      fileUrl: string;
      fileType: 'pdf' | 'image' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'video' | 'audio' | 'other';
      fileName: string;
      fileSizeBytes: number;
      uploadedAt: Date;
      note?: string;
      category?: string;
    }>;
    repoSubmissions: Array<{
      _id: Types.ObjectId;
      provider: 'github';
      repoUrl: string;
      displayName: string;
      branch?: string;
      commitHash?: string;
      note?: string;
      uploadedAt: Date;
    }>;
    codeSubmissions: Array<{
      _id: Types.ObjectId;
    }>;
    progressUpdates: Array<{
      _id: Types.ObjectId;
      note: string;
      milestoneRef?: string;
      submittedAt: Date;
    }>;
    updatedAt: Date;
  } | null,
): AdminDealReviewItem => ({
  ...buildAdminDealItem(
    deal,
    investor?.displayName ?? 'Investor',
    startup?.name ?? 'Startup',
    student?.displayName ?? 'Student',
  ),
  createdAt: toIso(deal.createdAt),
  updatedAt: toIso(deal.updatedAt),
  ...(deal.fundTransferInitiatedAt ? { fundTransferInitiatedAt: toIso(deal.fundTransferInitiatedAt) } : {}),
  ...(deal.closedAt ? { closedAt: toIso(deal.closedAt) } : {}),
  startup: {
    _id: startup ? String(startup._id) : String(deal.startupId),
    name: startup?.name ?? 'Startup',
    tagline: startup?.tagline ?? 'No startup summary available.',
    category: startup?.category ?? 'Category pending',
    stage: startup?.stage ?? 'Stage pending',
    ...(startup?.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
    ...(startup?.projectId ? { projectId: String(startup.projectId) } : {}),
    teamSize: startup?.teamSize ?? startup?.founderIds.length ?? 0,
    ...(typeof startup?.fundingNeeded === 'number' ? { fundingNeeded: startup.fundingNeeded } : {}),
    activeProducts: startup?.activeProducts ?? 0,
    ...(startup?.launchedAt ? { launchedAt: toIso(startup.launchedAt) } : {}),
    innovationScoreAtLaunch: startup?.innovationScoreAtLaunch ?? 0,
    traction: {
      patentFiled: startup?.traction?.patentFiled ?? false,
      mvpBuilt: startup?.traction?.mvpBuilt ?? false,
      revenueGenerating: startup?.traction?.revenueGenerating ?? false,
      ...(typeof startup?.traction?.usersCount === 'number' ? { usersCount: startup.traction.usersCount } : {}),
    },
    sharePool: {
      totalShares: startup?.totalShares ?? 0,
      availableShares: startup?.availableShares ?? 0,
      reservedForSole: startup?.reservedForSole ?? 0,
      maxPennyInvestors: startup?.maxPennyInvestors ?? 0,
      currentPennyCount: startup?.currentPennyCount ?? 0,
      hasSoleInvestor: startup?.hasSoleInvestor ?? false,
    },
    founders: founders.map((founder) => ({
      _id: String(founder._id),
      displayName: founder.displayName,
      ...(founder.avatar ? { avatar: founder.avatar } : {}),
      innovationScore: founder.innovationScore ?? 0,
      scoreBreakdown: founder.scoreBreakdown ?? {},
      ...(founder.domain ? { domain: founder.domain } : {}),
    })),
    ...(startup?.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
  },
  student: {
    _id: student ? String(student._id) : String(deal.studentId),
    displayName: student?.displayName ?? 'Student',
    ...(student?.avatar ? { avatar: student.avatar } : {}),
    role: student?.role ?? UserRole.STUDENT,
    innovationScore: student?.innovationScore ?? 0,
  },
  investor: {
    _id: investor ? String(investor._id) : String(deal.investorId),
    displayName: investor?.displayName ?? 'Investor',
    ...(investor?.avatar ? { avatar: investor.avatar } : {}),
    role: investor?.role ?? UserRole.INVESTOR,
    innovationScore: investor?.innovationScore ?? 0,
  },
  scoreEvents: scoreEvents.map((event) => ({
    _id: String(event._id),
    trigger: event.trigger,
    delta: event.delta,
    scoreAfter: event.scoreAfter,
    createdAt: toIso(event.createdAt),
  })),
  ...(workspace
    ? {
        workspace: {
          _id: String(workspace._id),
          title: workspace.title,
          category: workspace.category,
          stage: workspace.stage,
          progressPercent: workspace.progressPercent,
          milestones: workspace.milestones.map((milestone) => ({
            _id: String(milestone._id),
            name: milestone.name,
            isCompleted: milestone.isCompleted,
            completionPercent: milestone.completionPercent,
            ...(milestone.completedAt ? { completedAt: toIso(milestone.completedAt) } : {}),
          })),
          evidenceSummary: {
            uploadsCount: workspace.uploads.length,
            repoCount: workspace.repoSubmissions.length,
            codeCount: workspace.codeSubmissions.length,
            progressUpdatesCount: workspace.progressUpdates.length,
          },
          uploads: workspace.uploads
            .slice()
            .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
            .slice(0, 6)
            .map((upload) => ({
              _id: String(upload._id),
              fileUrl: upload.fileUrl,
              fileType: upload.fileType,
              fileName: upload.fileName,
              fileSizeBytes: upload.fileSizeBytes,
              uploadedAt: toIso(upload.uploadedAt),
              ...(upload.note ? { note: upload.note } : {}),
              ...(upload.category ? { category: upload.category } : {}),
            })),
          repoSubmissions: workspace.repoSubmissions
            .slice()
            .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
            .slice(0, 4)
            .map((repo) => ({
              _id: String(repo._id),
              provider: repo.provider,
              repoUrl: repo.repoUrl,
              displayName: repo.displayName,
              ...(repo.branch ? { branch: repo.branch } : {}),
              ...(repo.commitHash ? { commitHash: repo.commitHash } : {}),
              ...(repo.note ? { note: repo.note } : {}),
              uploadedAt: toIso(repo.uploadedAt),
            })),
          progressUpdates: workspace.progressUpdates
            .slice()
            .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
            .slice(0, 6)
            .map((update) => ({
              _id: String(update._id),
              note: update.note,
              ...(update.milestoneRef ? { milestoneRef: update.milestoneRef } : {}),
              submittedAt: toIso(update.submittedAt),
            })),
          updatedAt: toIso(workspace.updatedAt),
        },
      }
    : {}),
});

const deleteRefreshTokensForUser = async (userId: string) => {
  const redisClient = redis as unknown as {
    scan?: (cursor: string) => Promise<[string, string[]]>;
  };
  const scan = typeof redisClient.scan === 'function' ? redisClient.scan.bind(redisClient) : null;
  const sessionIndexKey = `session-index:${userId}`;

  if (!scan) {
    try {
      const indexedTokenIds = ((await redis.smembers(sessionIndexKey)) as string[]) ?? [];
      if (indexedTokenIds.length === 0) {
        await redis.del(sessionIndexKey);
        return;
      }

      await Promise.all([
        ...indexedTokenIds.map((tokenId) => redis.del(`refresh:${tokenId}`)),
        ...indexedTokenIds.map((tokenId) => redis.del(`session:${userId}:${tokenId}`)),
        redis.del(sessionIndexKey),
      ]);
    } catch (error) {
      logError(`Failed to delete refresh tokens for user ${userId}`, error);
    }
    return;
  }

  try {
    let cursor = '0';
    const tokenIds = new Set<string>(
      (((await redis.smembers(sessionIndexKey)) as string[]) ?? []).filter(Boolean),
    );

    do {
      const [nextCursor, keys] = await scan(cursor);
      cursor = nextCursor;
      for (const key of keys) {
        if (!key.startsWith('refresh:')) continue;
        const value = await redis.get<string>(key);
        if (value === userId) {
          tokenIds.add(key.slice('refresh:'.length));
        }
      }
    } while (cursor !== '0');

    if (tokenIds.size > 0) {
      const deleteTargets = Array.from(tokenIds).flatMap((tokenId) => [
        `refresh:${tokenId}`,
        `session:${userId}:${tokenId}`,
      ]);

      await Promise.all([
        ...deleteTargets.map((key) => redis.del(key)),
        redis.del(sessionIndexKey),
      ]);
      return;
    }

    await redis.del(sessionIndexKey);
  } catch (error) {
    logError(`Failed to delete refresh tokens for user ${userId}`, error);
  }
};

const findUser = async (userId: string, session?: ClientSession) => {
  const query = User.findById(userId).select(
    '_id displayName email role innovationScore isActive profileComplete registrationStage adminApprovalStatus adminApprovalRequestedAt adminApprovedAt adminApprovedBy adminApprovalRejectedAt adminApprovalRejectedReason accessGrantedBy accessExpiresAt createdAt avatar scoreBreakdown institutionProfile',
  );
  if (session) {
    query.session(session);
  }
  const user = await query;
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
};

export const listUsers = async (params: { role?: UserRole; isActive?: boolean; page: number; limit: number }): Promise<AdminUsersResponse> => {
  const filter: Record<string, unknown> = {};
  if (params.role) filter.role = params.role;
  if (params.isActive !== undefined) filter.isActive = params.isActive;

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(
        '_id displayName email role innovationScore isActive profileComplete registrationStage adminApprovalStatus adminApprovalRequestedAt adminApprovedAt adminApprovalRejectedAt adminApprovalRejectedReason accessGrantedBy accessExpiresAt createdAt',
      )
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((user) => userListItem(user)),
    total,
    page: params.page,
    limit: params.limit,
  };
};

export const listRegistrationRequests = async (params: {
  status: 'pending' | 'approved' | 'rejected';
  role?: UserRole;
}): Promise<{ items: AdminRegistrationRequestItem[]; total: number }> => {
  const filter: Record<string, unknown> = {
    role: { $in: Array.from(NON_STUDENT_REGISTRATION_ROLES) },
    adminApprovalStatus: params.status,
  };

  if (params.role) {
    filter.role = params.role;
  }

  const items = await User.find(filter)
    .select(
      '_id displayName email role isActive createdAt adminApprovalStatus adminApprovalRequestedAt adminApprovedAt adminApprovalRejectedAt adminApprovalRejectedReason domain bio institutionProfile institutionVerification',
    )
    .sort({ adminApprovalRequestedAt: -1, createdAt: -1 })
    .lean();

  return {
    items: items.map((user) => registrationRequestItem(user)),
    total: items.length,
  };
};

export const updateUserRole = async (adminId: string, userId: string, role: UserRole) => {
  const user = await findUser(userId);
  const previousRole = user.role;

  if (previousRole !== UserRole.ADMIN && role === UserRole.ADMIN) {
    await assertAdminCapacityAvailable();
  }

  user.role = role;
  await user.save();
  await deleteRefreshTokensForUser(userId);
  await createAudit(adminId, 'USER_ROLE_CHANGED', userId, 'User', { previousRole, nextRole: role });
  return userListItem(user.toObject());
};

export const updateUserAccess = async (adminId: string, userId: string, isActive: boolean) => {
  const user = await findUser(userId);
  user.isActive = isActive;
  await user.save();
  await deleteRefreshTokensForUser(userId);
  await createAudit(adminId, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', userId, 'User', { isActive });
  return userListItem(user.toObject());
};

export const deleteUser = async (adminId: string, userId: string) => {
  const result = await runMongoTransaction(async (session) => {
    const user = await findUser(userId, session);

    if (user.role === UserRole.ADMIN) {
      throw new ApiError(403, 'ADMIN_USER_DELETE_FORBIDDEN', 'Admin users cannot be deleted.');
    }

    await createAudit(
      adminId,
      'USER_DELETED',
      userId,
      'User',
      {
        role: user.role,
        email: user.email,
        displayName: user.displayName,
      },
      session,
    );

    await User.deleteOne({ _id: user._id }).session(session);

    return { deleted: true as const };
  });

  await deleteRefreshTokensForUser(userId);
  return result;
};

export const reviewRegistrationRequest = async (
  adminId: string,
  userId: string,
  payload: { decision: 'approved' | 'rejected'; reason?: string },
) => {
  const user = await findUser(userId);

  if (!NON_STUDENT_REGISTRATION_ROLES.has(user.role)) {
    throw new ApiError(
      400,
      'REGISTRATION_REQUEST_NOT_SUPPORTED',
      'Only non-student registration requests can be reviewed here.',
    );
  }

  if (user.adminApprovalStatus !== 'pending') {
    throw new ApiError(
      400,
      'REGISTRATION_REQUEST_ALREADY_REVIEWED',
      'This registration request has already been reviewed.',
    );
  }

  if (payload.decision === 'approved' && (user.role === UserRole.SCHOOL || user.role === UserRole.COLLEGE)) {
    assertInstitutionVerificationReadyForApproval(user.role, user.institutionVerification);
  }

  if (payload.decision === 'approved') {
    user.adminApprovalStatus = 'approved';
    user.adminApprovedAt = new Date();
    user.adminApprovedBy = new Types.ObjectId(adminId);
    user.adminApprovalRejectedAt = undefined;
    user.adminApprovalRejectedReason = undefined;
    user.isActive = true;
    user.registrationStage = deriveApprovedRegistrationStage(user);
  } else {
    user.adminApprovalStatus = 'rejected';
    user.adminApprovalRejectedAt = new Date();
    user.adminApprovalRejectedReason =
      payload.reason?.trim() || 'Registration request rejected by admin';
    user.adminApprovedAt = undefined;
    user.adminApprovedBy = null;
    user.isActive = false;
  }

  await user.save();

  if (payload.decision === 'approved') {
    await createAudit(adminId, 'REGISTRATION_REQUEST_APPROVED', userId, 'User', {
      role: user.role,
    });
    await pushNotification(
      userId,
      'system',
      'Registration approved',
      'Your ProMove registration request has been approved. You can now sign in.',
      '/login',
    );
  } else {
    await deleteRefreshTokensForUser(userId);
    await createAudit(adminId, 'REGISTRATION_REQUEST_REJECTED', userId, 'User', {
      role: user.role,
      reason: user.adminApprovalRejectedReason,
    });
    await pushNotification(
      userId,
      'system',
      'Registration request reviewed',
      user.adminApprovalRejectedReason ||
        'Your ProMove registration request was rejected. Please contact support.',
      '/login',
    );
  }

  return userListItem(user.toObject());
};

export const listPatents = async (status?: string): Promise<AdminPatentItem[]> => {
  const patents = await Patent.find(status ? { status } : {}).sort({ createdAt: -1 }).lean();
  const studentIds = patents.map((patent) => String(patent.studentId));
  const students = studentIds.length > 0
    ? await User.find({ _id: { $in: studentIds } })
        .select('_id displayName innovationScore avatar scoreBreakdown')
        .lean()
    : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return patents.map((patent) => {
    const student = studentMap.get(String(patent.studentId));
    return {
      _id: String(patent._id),
      studentId: String(patent.studentId),
      projectTitle: patent.projectTitle,
      status: patent.status,
      submittedAt: toIso(patent.submittedAt),
      ...(patent.adminReviewedAt ? { adminReviewedAt: toIso(patent.adminReviewedAt) } : {}),
      ...(patent.adminReviewedBy ? { adminReviewedBy: String(patent.adminReviewedBy) } : {}),
      ...(patent.adminNotes ? { adminNotes: patent.adminNotes } : {}),
      scoreAwarded: patent.scoreAwarded,
      student: {
        _id: String(patent.studentId),
        displayName: student?.displayName ?? 'Student',
        innovationScore: student?.innovationScore ?? 0,
        ...(student?.avatar ? { avatar: student.avatar } : {}),
        scoreBreakdown: student?.scoreBreakdown ?? {
          problemsClaimed: 0,
          problemsCompleted: 0,
          skillsCompleted: 0,
          progressUploads: 0,
          patentsSubmitted: 0,
          patentsApproved: 0,
          mvpsVerified: 0,
          marketReadyVerified: 0,
          startupsLaunched: 0,
        },
      },
      questionnaire: patent.questionnaire,
      filingDocuments: patent.filingDocuments,
      supportingDocuments: patent.supportingDocuments ?? [],
      ...(patent.patentStage ? { patentStage: patent.patentStage } : {}),
      ...(patent.ipoApplicationNumber ? { ipoApplicationNumber: patent.ipoApplicationNumber } : {}),
      ...(patent.ipoFilingDate ? { ipoFilingDate: toIso(patent.ipoFilingDate) } : {}),
      ...(patent.publicationDate ? { publicationDate: toIso(patent.publicationDate) } : {}),
      ...(patent.grantNumber ? { grantNumber: patent.grantNumber } : {}),
      ...(patent.grantDate ? { grantDate: toIso(patent.grantDate) } : {}),
    };
  });
};

export const approvePatent = async (adminId: string, patentId: string, trigger: ScoreTrigger) => {
  const patent = await Patent.findById(patentId);
  if (!patent) throw new ApiError(404, 'PATENT_NOT_FOUND', 'Patent not found');
  if (!['submitted', 'under_review'].includes(patent.status)) {
    throw new ApiError(400, 'PATENT_NOT_REVIEWABLE', 'Patent cannot be approved in its current state');
  }

  const studentExists = await User.exists({ _id: patent.studentId });
  if (!studentExists) {
    throw new ApiError(
      400,
      'PATENT_STUDENT_NOT_FOUND',
      'Patent cannot be approved because the submitting student no longer exists',
    );
  }

  const reviewedAt = new Date();
  const reviewedBy = new Types.ObjectId(adminId);
  const updateResult = await Patent.updateOne(
    { _id: patent._id, status: { $in: ['submitted', 'under_review'] } },
    {
      $set: {
        status: 'approved',
        adminReviewedAt: reviewedAt,
        adminReviewedBy: reviewedBy,
        scoreAwarded: true,
      },
    },
  );

  if (updateResult.matchedCount === 0) {
    throw new ApiError(400, 'PATENT_NOT_REVIEWABLE', 'Patent cannot be approved in its current state');
  }

  await applyScore({
    userId: String(patent.studentId),
    trigger: 'PATENT_SUBMITTED',
    metadata: {
      patentId: String(patent._id),
      adminId,
      verifiedByAdmin: true,
    },
    idempotencyKey: `patent-submitted:first:${patent.studentId}`,
  });

  const newScore = await applyScore({
    userId: String(patent.studentId),
    trigger,
    metadata: { patentId: String(patent._id), adminId },
    idempotencyKey: `patent-approved:${patent._id}`,
  });

  await pushNotification(
    String(patent.studentId),
    'patent_status',
    'Patent Approved! Innovation Score updated',
    `Your patent for ${patent.projectTitle} has been approved.`,
  );

  await createAudit(adminId, 'PATENT_APPROVED', String(patent._id), 'Patent', { studentId: String(patent.studentId) });
  return newScore;
};

export const rejectPatent = async (adminId: string, patentId: string, adminNotes: string) => {
  const patent = await Patent.findById(patentId);
  if (!patent) throw new ApiError(404, 'PATENT_NOT_FOUND', 'Patent not found');
  if (!['submitted', 'under_review'].includes(patent.status)) {
    throw new ApiError(400, 'PATENT_NOT_REVIEWABLE', 'Patent cannot be rejected in its current state');
  }

  const reviewedAt = new Date();
  const reviewedBy = new Types.ObjectId(adminId);
  const updateResult = await Patent.updateOne(
    { _id: patent._id, status: { $in: ['submitted', 'under_review'] } },
    {
      $set: {
        status: 'rejected',
        adminReviewedAt: reviewedAt,
        adminReviewedBy: reviewedBy,
        adminNotes,
      },
    },
  );

  if (updateResult.matchedCount === 0) {
    throw new ApiError(400, 'PATENT_NOT_REVIEWABLE', 'Patent cannot be rejected in its current state');
  }

  await pushNotification(String(patent.studentId), 'patent_status', 'Patent Review Complete', adminNotes);
  await createAudit(adminId, 'PATENT_REJECTED', String(patent._id), 'Patent', { studentId: String(patent.studentId) });
};

export const listAwards = async (): Promise<AdminAwardItem[]> => {
  const awards = await AdminAward.find({ status: { $in: ['submitted', 'under_review'] } }).sort({ createdAt: -1 }).lean();
  const studentIds = awards.map((award) => String(award.studentId));
  const students = studentIds.length > 0
    ? await User.find({ _id: { $in: studentIds } }).select('_id displayName innovationScore').lean()
    : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return awards.map((award) => {
    const student = studentMap.get(String(award.studentId));
    return {
      _id: String(award._id),
      studentId: String(award.studentId),
      title: award.title,
      description: award.description,
      status: award.status,
      submittedAt: toIso(award.submittedAt),
      ...(award.adminReviewedAt ? { adminReviewedAt: toIso(award.adminReviewedAt) } : {}),
      ...(award.adminReviewedBy ? { adminReviewedBy: String(award.adminReviewedBy) } : {}),
      ...(award.adminNotes ? { adminNotes: award.adminNotes } : {}),
      student: {
        _id: String(award.studentId),
        displayName: student?.displayName ?? 'Student',
        innovationScore: student?.innovationScore ?? 0,
      },
    };
  });
};

export const approveAward = async (adminId: string, awardId: string) => {
  const award = await AdminAward.findById(awardId);
  if (!award) throw new ApiError(404, 'AWARD_NOT_FOUND', 'Award not found');
  if (!['submitted', 'under_review'].includes(award.status)) {
    throw new ApiError(400, 'AWARD_NOT_REVIEWABLE', 'Award cannot be approved in its current state');
  }

  award.status = 'approved';
  award.adminReviewedAt = new Date();
  award.adminReviewedBy = new Types.ObjectId(adminId);
  await award.save();

  await pushNotification(
    String(award.studentId),
    'system',
    'Award approved',
    `${award.title} has been approved by the admin team.`,
  );

  await createAudit(adminId, 'AWARD_APPROVED', String(award._id), 'Award', { studentId: String(award.studentId) });
};

export const rejectAward = async (adminId: string, awardId: string, adminNotes: string) => {
  const award = await AdminAward.findById(awardId);
  if (!award) throw new ApiError(404, 'AWARD_NOT_FOUND', 'Award not found');

  award.status = 'rejected';
  award.adminReviewedAt = new Date();
  award.adminReviewedBy = new Types.ObjectId(adminId);
  award.adminNotes = adminNotes;
  await award.save();

  await pushNotification(String(award.studentId), 'system', 'Award review complete', adminNotes);
  await createAudit(adminId, 'AWARD_REJECTED', String(award._id), 'Award', { studentId: String(award.studentId) });
};

export const verifyMilestone = async (adminId: string, milestoneId: string, milestoneType: 'MVP' | 'PROTOTYPE' | 'MARKET_READY') => {
  const workspace = await Workspace.findOne({ 'milestones._id': milestoneId });
  if (!workspace) throw new ApiError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const milestone = workspace.milestones.find(
    (entry) => String(entry._id) === milestoneId,
  );
  if (!milestone) throw new ApiError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const existingAward = await ScoreEvent.exists({
    userId: workspace.ownerId,
    'metadata.milestoneId': milestoneId,
  });

  if (existingAward) {
    const user = await User.findById(workspace.ownerId).select('innovationScore').lean();
    return user?.innovationScore ?? 0;
  }

  milestone.isCompleted = true;
  milestone.completionPercent = 100;
  milestone.completedAt = new Date();
  milestone.completedBy = new Types.ObjectId(adminId);
  await workspace.save();

  const trigger = milestoneType === 'MARKET_READY' ? 'MARKET_READY_VERIFIED' : 'MVP_VERIFIED';
  const newScore = await applyScore({
    userId: String(workspace.ownerId),
    trigger,
    metadata: { workspaceId: String(workspace._id), milestoneId, milestoneType, adminId },
    idempotencyKey: `milestone-verified:${milestoneId}:${trigger}`,
  });

  await pushNotification(
    String(workspace.ownerId),
    'system',
    `${milestoneType === 'MARKET_READY' ? 'Market ready' : milestoneType === 'PROTOTYPE' ? 'Prototype' : 'MVP'} milestone verified`,
    `Your ${milestoneType.toLowerCase().replace('_', ' ')} milestone was verified by an admin.`,
  );

  await createAudit(adminId, 'MILESTONE_VERIFIED', String(workspace._id), 'Workspace', { milestoneId, milestoneType });
  return newScore;
};

export const listDealsAwaitingApproval = async (): Promise<AdminDealItem[]> => {
  const deals = await Deal.find({
    status: { $ne: 'cancelled' },
  }).sort({ adminApprovalRequired: -1, stage: -1, updatedAt: -1, createdAt: -1 }).lean();

  const investorIds = [...new Set(deals.map((deal) => String(deal.investorId)))];
  const startupIds = [...new Set(deals.map((deal) => String(deal.startupId)))];
  const studentIds = [...new Set(deals.map((deal) => String(deal.studentId)))];

  const [investors, startups, students] = await Promise.all([
    investorIds.length > 0 ? User.find({ _id: { $in: investorIds } }).select('_id displayName').lean() : Promise.resolve([]),
    startupIds.length > 0 ? Startup.find({ _id: { $in: startupIds } }).select('_id name').lean() : Promise.resolve([]),
    studentIds.length > 0 ? User.find({ _id: { $in: studentIds } }).select('_id displayName').lean() : Promise.resolve([]),
  ]);

  const investorMap = new Map(investors.map((investor) => [String(investor._id), investor]));
  const startupMap = new Map(startups.map((startup) => [String(startup._id), startup]));
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return deals
    .filter((deal) => {
      const investor = investorMap.get(String(deal.investorId));
      const startup = startupMap.get(String(deal.startupId));
      const student = studentMap.get(String(deal.studentId));
      return Boolean(investor && startup && student);
    })
    .map((deal) =>
      buildAdminDealItem(
        deal,
        investorMap.get(String(deal.investorId))!.displayName,
        startupMap.get(String(deal.startupId))!.name,
        studentMap.get(String(deal.studentId))!.displayName,
      ),
    );
};

export const getDealAwaitingApproval = async (dealId: string): Promise<AdminDealReviewItem> => {
  const deal = await Deal.findById(dealId).lean();
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const [investor, startup, student] = await Promise.all([
    User.findById(deal.investorId).select('_id displayName avatar role innovationScore').lean(),
    Startup.findById(deal.startupId)
      .select(
        '_id name tagline category stage pitchDeckUrl pitchDeckName projectId founderIds teamSize fundingNeeded activeProducts launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction',
      )
      .lean(),
    User.findById(deal.studentId).select('_id displayName avatar role innovationScore').lean(),
  ]);

  const founderIds = startup?.founderIds?.map((founderId) => String(founderId)) ?? [];

  const [founders, scoreEvents, workspace] = await Promise.all([
    founderIds.length > 0
      ? User.find({ _id: { $in: founderIds } })
          .select('_id displayName avatar innovationScore scoreBreakdown domain')
          .lean()
      : Promise.resolve([]),
    founderIds.length > 0
      ? ScoreEvent.find({ userId: startup!.founderIds[0] }).sort({ createdAt: -1 }).limit(12).lean()
      : Promise.resolve([]),
    startup?.projectId
      ? Workspace.findById(startup.projectId)
          .select(
            '_id title category stage progressPercent milestones uploads repoSubmissions codeSubmissions progressUpdates updatedAt',
          )
          .lean()
      : Promise.resolve(null),
  ]);

  return buildAdminDealReviewItem(
    deal,
    startup,
    student,
    investor,
    founders,
    scoreEvents,
    workspace,
  );
};

export const reviewDeal = async (
  adminId: string,
  dealId: string,
  payload: AdminDealReviewPayload,
): Promise<AdminDealReviewItem> => {
  const reviewResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findById(dealId).session(session);
    if (!deal || deal.status === 'cancelled') {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    if (deal.cancellationRequest?.status === 'pending') {
      throw new ApiError(
        400,
        'DEAL_CANCELLATION_PENDING',
        'Resolve the cancellation request before reviewing the transfer',
      );
    }

    if (deal.stage < 2) {
      throw new ApiError(400, 'DEAL_NOT_READY_FOR_REVIEW', 'This deal has not reached the mediation workflow yet');
    }

    if (payload.stockTransferStatus !== undefined && deal.stage < 3) {
      throw new ApiError(400, 'STOCK_TRANSFER_NOT_SUBMITTED', 'Stock transfer review starts after the deal reaches stage 3');
    }

    const reviewTouched =
      payload.stockTransferStatus !== undefined ||
      payload.reviewNotes !== undefined;
    const royaltyPercentage =
      payload.royaltyPercentage ?? deal.royalty?.promovePercentage ?? DEFAULT_PROMOVE_ROYALTY_PERCENTAGE;

    deal.mediatorLabel = deal.mediatorLabel || 'ProMove';
    deal.royalty = {
      promovePercentage: royaltyPercentage,
      promoveAmountINR: calculateRoyaltyAmount(deal.amountINR ?? 0, royaltyPercentage),
      status: payload.royaltyStatus ?? deal.royalty?.status ?? 'pending',
      ...(payload.royaltyStatus === 'received'
        ? { settledAt: new Date() }
        : deal.royalty?.settledAt
          ? { settledAt: deal.royalty.settledAt }
          : {}),
    };

    if (deal.stage >= 3) {
      const nextStockTransferStatus = payload.stockTransferStatus ?? deal.stockTransfer?.status ?? 'pending_review';
      deal.stockTransfer = {
        status: nextStockTransferStatus,
        requestedAt: deal.stockTransfer?.requestedAt ?? new Date(),
        requestedByRole: deal.stockTransfer?.requestedByRole ?? deal.requestOrigin ?? 'investor',
        requestSummary:
          deal.stockTransfer?.requestSummary ??
          `${deal.mediatorLabel || 'ProMove'} mediation review opened for the stock transfer.`,
        reviewNotes:
          payload.reviewNotes !== undefined
            ? payload.reviewNotes
            : deal.stockTransfer?.reviewNotes,
        ...(reviewTouched ? { reviewedAt: new Date(), reviewedBy: new Types.ObjectId(adminId) } : {}),
        ...(deal.stockTransfer?.reviewedAt && !reviewTouched ? { reviewedAt: deal.stockTransfer.reviewedAt } : {}),
        ...(deal.stockTransfer?.reviewedBy && !reviewTouched ? { reviewedBy: deal.stockTransfer.reviewedBy } : {}),
      };
      if (nextStockTransferStatus === 'rejected') {
        deal.adminApprovalRequired = false;
        deal.adminApprovedAt = undefined;
        deal.adminApprovedBy = undefined;
        deal.mediationStatus = 'rejected';

      } else {
        deal.mediationStatus = deal.adminApprovedAt ? 'approved' : 'under_review';
      }
    }

    deal.stockDetails = {
      shareClassLabel: deal.stockDetails?.shareClassLabel ?? DEFAULT_SHARE_CLASS_LABEL,
      sharePriceInr:
        deal.sharesAllocated > 0 && typeof deal.amountINR === 'number'
          ? round(deal.amountINR / deal.sharesAllocated)
          : deal.stockDetails?.sharePriceInr ?? 0,
      transferValueInr: deal.amountINR ?? deal.stockDetails?.transferValueInr ?? 0,
      totalSharesConsidered: deal.sharesAllocated ?? deal.stockDetails?.totalSharesConsidered ?? 0,
    };

    await deal.save({ session });

    await createAudit(
      adminId,
      payload.stockTransferStatus === 'rejected' ? 'DEAL_REJECTED' : 'DEAL_REVIEW_UPDATED',
      String(deal._id),
      'Deal',
      {
        stage: deal.stage,
        ...(payload.stockTransferStatus ? { stockTransferStatus: payload.stockTransferStatus } : {}),
        ...(payload.royaltyStatus ? { royaltyStatus: payload.royaltyStatus } : {}),
        ...(payload.royaltyPercentage !== undefined ? { royaltyPercentage: payload.royaltyPercentage } : {}),
        ...(payload.reviewNotes ? { reviewNotes: payload.reviewNotes } : {}),
      },
      session,
    );

    return {
      dealId: String(deal._id),
      studentId: String(deal.studentId),
      investorId: String(deal.investorId),
    };
  });

  if (payload.stockTransferStatus === 'rejected') {
    await Promise.all([
      pushNotification(
        reviewResult.studentId,
        'system',
        'Equity transfer requires changes',
        payload.reviewNotes || 'ProMove admin requested changes before the deal can be finalized.',
      ),
      pushNotification(
        reviewResult.investorId,
        'system',
        'Equity transfer requires changes',
        payload.reviewNotes || 'ProMove admin requested changes before the deal can be finalized.',
      ),
    ]);
  }

  return getDealAwaitingApproval(reviewResult.dealId);
};

export const reviewDealCancellation = async (
  adminId: string,
  dealId: string,
  payload: AdminDealCancellationReviewPayload,
): Promise<AdminDealReviewItem> => {
  const reviewResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findById(dealId).session(session);
    if (!deal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    if (deal.status === 'cancelled') {
      throw new ApiError(400, 'DEAL_ALREADY_CANCELLED', 'This deal is already cancelled');
    }

    if (deal.cancellationRequest?.status !== 'pending') {
      throw new ApiError(400, 'DEAL_CANCELLATION_NOT_PENDING', 'This deal is not awaiting cancellation review');
    }

    if (payload.decision === 'approved' && (deal.status === 'closed' || deal.stage === 4 || deal.adminApprovedAt)) {
      throw new ApiError(400, 'DEAL_CANCELLATION_LOCKED', 'Admin-approved deals cannot be cancelled');
    }

    const now = new Date();
    const reviewNotes = payload.reviewNotes?.trim();

    deal.cancellationRequest = {
      ...deal.cancellationRequest,
      status: payload.decision,
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: now,
      ...(reviewNotes ? { reviewNotes } : {}),
    };

    if (payload.decision === 'approved') {
      const note = reviewNotes || deal.cancellationRequest.reason || 'Cancellation approved by ProMove admin.';
      deal.status = 'cancelled';
      deal.mediationStatus = 'rejected';
      deal.adminApprovalRequired = false;
      deal.adminApprovedAt = undefined;
      deal.adminApprovedBy = undefined;
      deal.closedAt = undefined;
      deal.founderDecision = {
        status: 'rejected',
        respondedAt: now,
        respondedBy: new Types.ObjectId(adminId),
        note,
      };
      deal.negotiation = deal.negotiation || { status: 'cancelled', messages: [] };
      deal.negotiation.status = 'cancelled';
      deal.negotiation.notes = note;
      deal.negotiation.lastUpdatedAt = now;
      if (deal.stockTransfer?.status && deal.stockTransfer.status !== 'approved') {
        deal.stockTransfer = {
          ...deal.stockTransfer,
          status: 'rejected',
          reviewedAt: now,
          reviewedBy: new Types.ObjectId(adminId),
          reviewNotes: note,
        };
      }
    } else {
      deal.mediationStatus = deal.adminApprovedAt
        ? 'approved'
        : deal.stage >= 3 || deal.adminApprovalRequired
          ? 'under_review'
          : 'intake';
    }

    await deal.save({ session });
    await createAudit(
      adminId,
      payload.decision === 'approved' ? 'DEAL_REJECTED' : 'DEAL_REVIEW_UPDATED',
      String(deal._id),
      'Deal',
      {
        cancellationDecision: payload.decision,
        ...(reviewNotes ? { reviewNotes } : {}),
      },
      session,
    );

    return {
      dealId: String(deal._id),
      startupId: String(deal.startupId),
      investorId: String(deal.investorId),
      studentId: String(deal.studentId),
      decision: payload.decision,
      reviewNotes,
    };
  });

  await invalidateInvestmentCaches(reviewResult.startupId, reviewResult.investorId);

  const title =
    reviewResult.decision === 'approved'
      ? 'Deal cancellation approved'
      : 'Deal cancellation declined';
  const body =
    reviewResult.decision === 'approved'
      ? reviewResult.reviewNotes || 'ProMove admin approved the cancellation request.'
      : reviewResult.reviewNotes || 'ProMove admin declined the cancellation request.';

  await Promise.all([
    pushNotification(reviewResult.studentId, 'system', title, body),
    pushNotification(reviewResult.investorId, 'system', title, body),
  ]);

  return getDealAwaitingApproval(reviewResult.dealId);
};

export const approveDealStage = async (adminId: string, dealId: string) => {
  const approvalResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findById(dealId).session(session);
    if (!deal || deal.status === 'cancelled') throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    if (deal.cancellationRequest?.status === 'pending') {
      throw new ApiError(
        400,
        'DEAL_CANCELLATION_PENDING',
        'Resolve the cancellation request before approving the transfer',
      );
    }
    if (!deal.adminApprovalRequired || deal.stage !== 3) {
      throw new ApiError(400, 'DEAL_NOT_PENDING_APPROVAL', 'Deal is not awaiting admin approval');
    }

    const startup = await Startup.findById(deal.startupId)
      .session(session)
      .select(
        '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
      )
      .lean<Parameters<typeof validateInvestmentTerms>[0]['startup'] | null>();

    if (!startup) {
      throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }

    if (
      deal.investorType === 'sole' &&
      startup.hasSoleInvestor &&
      (!startup.soleInvestorId || String(startup.soleInvestorId) !== String(deal.investorId))
    ) {
      throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
    }

    await validateInvestmentTerms({
      startup,
      investorType: deal.investorType,
      equityPercent: deal.equityPercent,
      chosenRole: deal.investorRole,
      excludeId: String(deal._id),
      session,
    });

    const allocationUpdate: Record<string, unknown> = {
      $inc: {
        availableShares: -deal.sharesAllocated,
        ...(deal.investorType === 'penny' ? { currentPennyCount: 1 } : {}),
      },
    };

    if (deal.investorType === 'sole') {
      allocationUpdate.$set = {
        hasSoleInvestor: true,
        soleInvestorId: deal.investorId,
      };
    }

    const allocationResult = await Startup.updateOne(
      {
        _id: startup._id,
        availableShares: startup.availableShares,
        currentPennyCount: startup.currentPennyCount,
        hasSoleInvestor: startup.hasSoleInvestor,
        soleInvestorId: startup.soleInvestorId ?? null,
      },
      allocationUpdate,
      { session },
    );

    if (!allocationResult.modifiedCount) {
      throw new ApiError(
        409,
        'STARTUP_ALLOCATION_CONFLICT',
        'The startup allocation changed while processing this investment. Refresh and try again.',
      );
    }

    const approvedAt = new Date();
    const reviewedBy = new Types.ObjectId(adminId);
    const royaltyPercentage = deal.royalty?.promovePercentage ?? DEFAULT_PROMOVE_ROYALTY_PERCENTAGE;
    deal.adminApprovedAt = approvedAt;
    deal.adminApprovedBy = new Types.ObjectId(adminId);
    deal.adminApprovalRequired = false;
    deal.mediatorLabel = deal.mediatorLabel || 'ProMove';
    deal.mediationStatus = 'approved';
    deal.officialContract = {
      contractNumber: deal.officialContract?.contractNumber ?? generateDealContractNumber(),
      generatedAt: deal.officialContract?.generatedAt ?? approvedAt,
    };
    deal.stockDetails = {
      shareClassLabel: deal.stockDetails?.shareClassLabel ?? DEFAULT_SHARE_CLASS_LABEL,
      sharePriceInr:
        deal.sharesAllocated > 0 && typeof deal.amountINR === 'number'
          ? round(deal.amountINR / deal.sharesAllocated)
          : deal.stockDetails?.sharePriceInr ?? 0,
      transferValueInr: deal.amountINR ?? deal.stockDetails?.transferValueInr ?? 0,
      totalSharesConsidered: deal.sharesAllocated ?? deal.stockDetails?.totalSharesConsidered ?? 0,
    };
    deal.stockTransfer = {
      status: 'approved',
      requestedAt: deal.stockTransfer?.requestedAt ?? approvedAt,
      requestedByRole: deal.stockTransfer?.requestedByRole ?? deal.requestOrigin ?? 'investor',
      requestSummary:
        deal.stockTransfer?.requestSummary ??
        `${deal.mediatorLabel || 'ProMove'} mediation approved the stock transfer.`,
      reviewNotes: deal.stockTransfer?.reviewNotes,
      reviewedAt: approvedAt,
      reviewedBy,
    };
    deal.royalty = {
      promovePercentage: royaltyPercentage,
      promoveAmountINR: calculateRoyaltyAmount(deal.amountINR ?? 0, royaltyPercentage),
      status: deal.royalty?.status ?? 'pending',
      ...(deal.royalty?.settledAt ? { settledAt: deal.royalty.settledAt } : {}),
    };

    await deal.save({ session });
    await createAudit(
      adminId,
      'DEAL_STAGE_APPROVED',
      String(deal._id),
      'Deal',
      {
        studentId: String(deal.studentId),
        investorId: String(deal.investorId),
      },
      session,
    );

    return {
      startupId: String(deal.startupId),
      investorId: String(deal.investorId),
      studentId: String(deal.studentId),
    };
  });

  await invalidateInvestmentCaches(approvalResult.startupId, approvalResult.investorId);

  const [student, investor] = await Promise.all([
    User.findById(approvalResult.studentId).select('_id displayName').lean(),
    User.findById(approvalResult.investorId).select('_id displayName').lean(),
  ]);

  if (student) {
    await pushNotification(
      String(student._id),
      'system',
      'Equity transfer verified by ProMove admin',
      'Your deal equity has been verified. Your official contract is ready to download from the deal.',
    );
  }
  if (investor) {
    await pushNotification(
      String(investor._id),
      'system',
      'Equity transfer verified by ProMove admin',
      'You may now close the deal. Your official contract is ready to download from the deal.',
    );
  }
};

export const getAdminCapTable = async (startupId: string) => getStartupCapTable(startupId, '', UserRole.ADMIN);

export const getStartupAdminRecord = async (startupId: string): Promise<AdminStartupRecord> => {
  const startup = await Startup.findById(startupId)
    .select('_id launchedToInvestors launchedToMentors launchedAt innovationScoreAtLaunch traction')
    .lean<{
      _id: Types.ObjectId;
      launchedToInvestors?: boolean;
      launchedToMentors?: boolean;
      launchedAt?: Date;
      innovationScoreAtLaunch?: number;
      traction?: {
        patentFiled?: boolean;
        mvpBuilt?: boolean;
        revenueGenerating?: boolean;
        usersCount?: number;
      };
    } | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const [deals, capTable, auditLogs] = await Promise.all([
    Deal.find({ startupId })
      .select(
        '_id investorId investorType amountINR equityPercent sharesAllocated stage status investorRole royalty createdAt',
      )
      .sort({ createdAt: -1 })
      .lean<Array<{
        _id: Types.ObjectId;
        investorId: Types.ObjectId;
        investorType: 'penny' | 'sole';
        amountINR?: number;
        equityPercent?: number;
        sharesAllocated?: number;
        stage: number;
        status: 'active' | 'closed' | 'cancelled';
        investorRole?: 'shareholder' | 'director' | 'observer';
        royalty?: { promoveAmountINR?: number };
        createdAt: Date;
      }>>(),
    getAdminCapTable(startupId),
    AdminAuditLog.find({ targetId: startupId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<Array<{
        _id: Types.ObjectId;
        adminId: Types.ObjectId;
        action: string;
        targetModel: string;
        metadata?: Record<string, unknown>;
        createdAt: Date;
      }>>(),
  ]);

  const userIds = [
    ...new Set([
      ...deals.map((deal) => String(deal.investorId)),
      ...auditLogs.map((log) => String(log.adminId)),
    ]),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('_id displayName')
        .lean<Array<{ _id: Types.ObjectId; displayName: string }>>()
    : [];
  const nameMap = new Map(users.map((user) => [String(user._id), user.displayName]));

  const activeDeals = deals.filter((deal) => deal.status !== 'cancelled');

  return {
    startupId,
    funds: {
      totalRaisedINR: round(activeDeals.reduce((sum, deal) => sum + (deal.amountINR ?? 0), 0)),
      totalRoyaltyOwedINR: round(
        activeDeals.reduce((sum, deal) => sum + (deal.royalty?.promoveAmountINR ?? 0), 0),
      ),
      activeDealCount: deals.filter((deal) => deal.status === 'active').length,
      closedDealCount: deals.filter((deal) => deal.status === 'closed').length,
      cancelledDealCount: deals.filter((deal) => deal.status === 'cancelled').length,
      pennyInvestorCount: activeDeals.filter((deal) => deal.investorType === 'penny').length,
      soleInvestorCount: activeDeals.filter((deal) => deal.investorType === 'sole').length,
      capTable: {
        totalShares: capTable.totalShares,
        availableShares: capTable.availableShares,
        founderRetainedEquity: capTable.founderRetained.equityPercent,
        totalInvestorEquity: capTable.totalInvestorEquity,
      },
    },
    marketReach: {
      launchedToInvestors: startup.launchedToInvestors ?? false,
      launchedToMentors: startup.launchedToMentors ?? false,
      ...(startup.launchedAt ? { launchedAt: toIso(startup.launchedAt) } : {}),
      innovationScoreAtLaunch: startup.innovationScoreAtLaunch ?? 0,
      traction: {
        patentFiled: startup.traction?.patentFiled ?? false,
        mvpBuilt: startup.traction?.mvpBuilt ?? false,
        revenueGenerating: startup.traction?.revenueGenerating ?? false,
        ...(typeof startup.traction?.usersCount === 'number'
          ? { usersCount: startup.traction.usersCount }
          : {}),
      },
    },
    investors: deals.map((deal) => ({
      dealId: String(deal._id),
      investorId: String(deal.investorId),
      investorName: nameMap.get(String(deal.investorId)) ?? 'Investor',
      investorType: deal.investorType,
      ...(typeof deal.amountINR === 'number' ? { amountINR: deal.amountINR } : {}),
      ...(typeof deal.equityPercent === 'number' ? { equityPercent: deal.equityPercent } : {}),
      ...(typeof deal.sharesAllocated === 'number'
        ? { sharesAllocated: deal.sharesAllocated }
        : {}),
      stage: deal.stage,
      status: deal.status,
      ...(deal.investorRole ? { investorRole: deal.investorRole } : {}),
      ...(typeof deal.royalty?.promoveAmountINR === 'number'
        ? { royaltyOwedINR: deal.royalty.promoveAmountINR }
        : {}),
      createdAt: toIso(deal.createdAt),
    })),
    auditTrail: auditLogs.map((log) => ({
      _id: String(log._id),
      action: log.action,
      adminId: String(log.adminId),
      adminName: nameMap.get(String(log.adminId)) ?? 'Admin',
      targetModel: log.targetModel,
      ...(log.metadata ? { metadata: log.metadata } : {}),
      createdAt: toIso(log.createdAt),
    })),
  };
};

export const updateDealInvestorRole = async (adminId: string, dealId: string, investorRole: 'shareholder' | 'director' | 'observer') => {
  const deal = await updateInvestmentRole(dealId, investorRole);
  await createAudit(adminId, 'DEAL_STAGE_APPROVED', dealId, 'Deal', { investorRole });
  return deal;
};

export const resetStartupSoleInvestor = async (adminId: string, startupId: string) => {
  await resetSoleInvestorForStartup(startupId);
  await createAudit(adminId, 'SOLE_INVESTOR_RESET', startupId, 'Startup');
  return { reset: true };
};

export const getInvestmentTypeBreakdown = async () => getDealInvestmentTypeAnalytics();

export const getAnalytics = async (): Promise<AdminAnalyticsData> => {
  const cacheKey = 'admin:analytics';
  const cached = await redis.get<string>(cacheKey);
  const cachedData = readRedisJson<AdminAnalyticsData>(cached);
  if (cachedData) return cachedData;

  const [users, deals, patents, auditLogs, topInnovators, investmentTypeBreakdown, awardsPending] = await Promise.all([
    User.find({}).select('_id displayName email role innovationScore isActive accessGrantedBy accessExpiresAt createdAt lastLogin').lean(),
    Deal.find({}).select('stage status').lean(),
    Patent.find({}).select('status').lean(),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    User.find({}).sort({ innovationScore: -1 }).limit(5).select('_id displayName email role innovationScore isActive accessGrantedBy accessExpiresAt createdAt').lean(),
    getDealInvestmentTypeAnalytics(),
    AdminAward.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
  ]);

  const totalUsers = users.length;
  const activeThisWeek = users.filter((user) => user.lastLogin && user.lastLogin >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const usersByRole = {
    student: users.filter((user) => user.role === UserRole.STUDENT).length,
    school: users.filter((user) => user.role === UserRole.SCHOOL).length,
    college: users.filter((user) => user.role === UserRole.COLLEGE).length,
    mentor: users.filter((user) => user.role === UserRole.MENTOR).length,
    investor: users.filter((user) => user.role === UserRole.INVESTOR).length,
    recruiter: users.filter((user) => user.role === UserRole.RECRUITER).length,
    admin: users.filter((user) => user.role === UserRole.ADMIN).length,
  } satisfies Record<UserRole, number>;

  const dealsByStage = {
    '1': deals.filter((deal) => deal.stage === 1).length,
    '2': deals.filter((deal) => deal.stage === 2).length,
    '3': deals.filter((deal) => deal.stage === 3).length,
    '4': deals.filter((deal) => deal.stage === 4).length,
  } as const;

  const patentsByStatus = {
    submitted: patents.filter((patent) => patent.status === 'submitted').length,
    under_review: patents.filter((patent) => patent.status === 'under_review').length,
    approved: patents.filter((patent) => patent.status === 'approved').length,
    rejected: patents.filter((patent) => patent.status === 'rejected').length,
  } as const;
  const platformUsage = await getPlatformUsageAnalytics(totalUsers);

  const result: AdminAnalyticsData = {
    totalUsers,
    usersByRole,
    activeThisWeek,
    totalDeals: deals.length,
    dealsByStage,
    dealConversionRate: deals.length > 0 ? Number(((dealsByStage['4'] / deals.length) * 100).toFixed(2)) : 0,
    totalPatents: patents.length,
    patentsByStatus,
    scoreDistribution: {
      '0-50': users.filter((user) => user.innovationScore <= 50).length,
      '51-100': users.filter((user) => user.innovationScore > 50 && user.innovationScore <= 100).length,
      '101-150': users.filter((user) => user.innovationScore > 100 && user.innovationScore <= 150).length,
      '151-200': users.filter((user) => user.innovationScore > 150).length,
    },
    topInnovators: topInnovators.map((user) => userListItem(user)),
    recentAdminActions: auditLogs.map((entry) => ({
      _id: String(entry._id),
      adminId: String(entry.adminId),
      action: entry.action,
      targetId: String(entry.targetId),
      targetModel: entry.targetModel,
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
      createdAt: toIso(entry.createdAt),
    })),
    patentsPending: patents.filter((patent) => patent.status === 'submitted' || patent.status === 'under_review').length,
    awardsPending,
    investmentTypeBreakdown,
    usageSummary: platformUsage.usageSummary,
    dailyUsage: platformUsage.dailyUsage,
    topRoutes: platformUsage.topRoutes,
    mostActiveUsers: platformUsage.mostActiveUsers,
    recentUserActivity: platformUsage.recentUserActivity,
    insights: platformUsage.insights,
  };

  await redis.set(cacheKey, JSON.stringify(result), { ex: ANALYTICS_CACHE_TTL_SECONDS });
  return result;
};

export const getAnalyticsLogs = async (limit = APP_LOG_TAIL_LINE_LIMIT): Promise<AdminAnalyticsLogEntry[]> => {
  const normalizedLimit = Math.min(Math.max(limit, 1), 50);
  const cacheKey = `admin:analytics:logs:${normalizedLimit}`;
  const cached = await redis.get<string>(cacheKey);
  const cachedData = readRedisJson<AdminAnalyticsLogEntry[]>(cached);
  if (cachedData) {
    return cachedData;
  }

  const logs = await listRecentApplicationLogs(normalizedLimit);
  await redis.set(cacheKey, JSON.stringify(logs), { ex: ANALYTICS_LOG_CACHE_TTL_SECONDS });
  return logs;
};

export const getAnalyticsUsers = async (
  query?: string,
  limit = 8,
): Promise<AdminUserActivitySearchResponse> => ({
  items: await searchUserActivitySummaries(query, limit),
});

export const getAnalyticsUserDetail = async (userId: string): Promise<AdminUserActivityDetail> =>
  getUserActivityDetail(userId);

export const validateUserAccessQuery = () => undefined;

export const getMentorshipPrograms = async (
  status?: 'Pending' | 'Assigned' | 'Rejected',
): Promise<AdminMentorshipProgramsResponse> => listAdminMentorshipPrograms(status);

export const getMentorDirectory = async (): Promise<AdminMentorListItem[]> => listAdminMentors();

export const createAdminMentorshipProgram = async (
  adminId: string,
  payload: AdminCreateMentorshipProgramPayload,
) => {
  const created = await createAdminInstitutionMentorshipProgram(adminId, payload);
  await createAudit(adminId, 'MENTORSHIP_PROGRAM_CREATED', created._id, 'InstitutionMentorshipProgram', {
    institutionId: created.institution._id,
    mentorId: created.mentor?._id,
    status: created.status,
  });
  return created;
};

export const createMentorProfile = async (
  adminId: string,
  payload: { displayName: string; email: string; domain?: string; bio?: string; headline?: string },
): Promise<AdminCreatedMentorProfile> => {
  const admin = await findUser(adminId);
  if (admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can create mentor profiles');
  }

  const normalizedEmail = payload.email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const displayName = sanitizePlainText(payload.displayName);
  const profileSlug = await generateProfileSlug(displayName);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_ROUNDS);

  const mentor = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: UserRole.MENTOR,
    displayName,
    profileSlug,
    ...(payload.domain ? { domain: sanitizePlainText(payload.domain) } : {}),
    ...(payload.bio ? { bio: sanitizePlainText(payload.bio) } : {}),
    ...(payload.headline ? { headline: sanitizePlainText(payload.headline) } : {}),
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: true,
    profileComplete: Boolean(payload.domain || payload.bio),
    registrationStage: 'basic',
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: 'not_required',
    adminApprovalStatus: 'approved',
    adminApprovedAt: new Date(),
    adminApprovedBy: new Types.ObjectId(adminId),
    mustChangePasswordOnNextLogin: true,
  });

  await createAudit(adminId, 'MENTOR_PROFILE_CREATED', String(mentor._id), 'User', {
    role: UserRole.MENTOR,
  });

  return {
    mentor: {
      _id: String(mentor._id),
      displayName: mentor.displayName,
      email: mentor.email,
      ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
      ...(mentor.domain ? { domain: mentor.domain } : {}),
      ...(mentor.bio ? { bio: mentor.bio } : {}),
      ...(mentor.headline ? { headline: mentor.headline } : {}),
      assignedProjects: 0,
      assignedPrograms: 0,
      createdAt: toIso(mentor.createdAt),
    },
    temporaryPassword,
  };
};

type OnboardAccountInput = {
  role: UserRole.MENTOR | UserRole.INVESTOR | UserRole.RECRUITER | UserRole.SCHOOL | UserRole.COLLEGE;
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  headline?: string;
  institutionProfile?: {
    institutionName?: string;
    location?: string;
    totalStudentsEnrolled?: number;
    academicYear?: string;
    organizationType?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
};

const ONBOARD_INSTITUTION_ROLES: UserRole[] = [UserRole.SCHOOL, UserRole.COLLEGE];

const buildCurrentAcademicYear = () => {
  const now = new Date();
  // Indian academic years roll over mid-year; June onward counts as the new year.
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

/**
 * Directly onboards a non-student account (mentor, investor, recruiter, school or
 * college) with a generated temporary password. The account is admin-approved and
 * active immediately; the user is forced to reset the password on first login.
 */
export const createOnboardedAccount = async (
  adminId: string,
  payload: OnboardAccountInput,
): Promise<AdminOnboardedAccount> => {
  const admin = await findUser(adminId);
  if (admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can onboard accounts');
  }

  const normalizedEmail = payload.email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const displayName = sanitizePlainText(payload.displayName);
  const profileSlug = await generateProfileSlug(displayName);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_ROUNDS);
  const now = new Date();
  const isInstitution = ONBOARD_INSTITUTION_ROLES.includes(payload.role);

  const baseFields = {
    email: normalizedEmail,
    passwordHash,
    role: payload.role,
    displayName,
    profileSlug,
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    adminApprovalStatus: 'approved' as const,
    adminApprovedAt: now,
    adminApprovedBy: new Types.ObjectId(adminId),
    mustChangePasswordOnNextLogin: true,
  };

  let user;

  if (isInstitution) {
    const profile = payload.institutionProfile ?? {};
    user = await User.create({
      ...baseFields,
      profileComplete: false,
      registrationStage: 'complete',
      verificationStatus: 'not_required',
      institutionVerificationStatus: 'verified',
      institutionVerifiedAt: now,
      institutionProfile: {
        institutionName: profile.institutionName
          ? sanitizePlainText(profile.institutionName)
          : displayName,
        location: profile.location ? sanitizePlainText(profile.location) : 'India',
        totalStudentsEnrolled: profile.totalStudentsEnrolled ?? 0,
        academicYear: profile.academicYear ?? buildCurrentAcademicYear(),
        iicStarRating: 0,
        ...(profile.organizationType
          ? { organizationType: sanitizePlainText(profile.organizationType) }
          : {}),
        specialties: [],
        locations: [],
        ...(profile.contactEmail ? { contactEmail: profile.contactEmail } : {}),
        ...(profile.contactPhone ? { contactPhone: sanitizePlainText(profile.contactPhone) } : {}),
        policies: [],
        stats: {
          totalInnovationActivities: 0,
          patentsFiled: 0,
          totalMentoringHours: 0,
          startupsLaunched: 0,
          industryCollaborations: 0,
        },
      },
    });
  } else {
    user = await User.create({
      ...baseFields,
      ...(payload.domain ? { domain: sanitizePlainText(payload.domain) } : {}),
      ...(payload.bio ? { bio: sanitizePlainText(payload.bio) } : {}),
      ...(payload.headline ? { headline: sanitizePlainText(payload.headline) } : {}),
      profileComplete: Boolean(payload.domain || payload.bio),
      registrationStage: 'basic',
      verificationStatus: 'not_required',
      institutionVerificationStatus: 'none',
    });
  }

  await createAudit(adminId, 'ACCOUNT_ONBOARDED', String(user._id), 'User', {
    role: payload.role,
  });

  return {
    user: {
      _id: String(user._id),
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      ...(user.domain ? { domain: user.domain } : {}),
      ...(user.headline ? { headline: user.headline } : {}),
      ...(user.bio ? { bio: user.bio } : {}),
      ...(user.institutionProfile?.institutionName
        ? { institutionName: user.institutionProfile.institutionName }
        : {}),
      createdAt: toIso(user.createdAt),
    },
    temporaryPassword,
  };
};

// ── Admin-operated student onboarding (per selected institution) ──────────────

const resolveOnboardingInstitutionRole = async (
  institutionId: string,
): Promise<UserRole.SCHOOL | UserRole.COLLEGE> => {
  if (!Types.ObjectId.isValid(institutionId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid institution id');
  }

  const institution = await User.findById(institutionId).select('_id role').lean();
  if (
    !institution ||
    (institution.role !== UserRole.SCHOOL && institution.role !== UserRole.COLLEGE)
  ) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  return institution.role;
};

export const adminListInstitutionRoster = async (
  institutionId: string,
  search?: string,
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return listStudentRoster(institutionId, institutionRole, search);
};

export const adminCreateInstitutionRosterEntry = async (
  adminId: string,
  institutionId: string,
  payload: {
    displayName: string;
    email: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  },
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return createInstitutionStudentRosterEntry(institutionId, institutionRole, adminId, payload);
};

export const adminCancelInstitutionRosterInvite = async (
  adminId: string,
  institutionId: string,
  rosterEntryId: string,
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return cancelStudentRosterInvite(institutionId, institutionRole, rosterEntryId);
};

export const adminImportInstitutionRoster = async (
  adminId: string,
  institutionId: string,
  file: { originalname: string; buffer: Buffer },
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return importStudentRosterEntries(institutionId, institutionRole, adminId, file);
};

export const adminImportInstitutionRosterWithCredentials = async (
  adminId: string,
  institutionId: string,
  file: { originalname: string; buffer: Buffer },
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return bulkCreateManagedStudentCredentials(institutionId, institutionRole, adminId, file);
};

export const adminCreateInstitutionStudentCredentials = async (
  adminId: string,
  institutionId: string,
  payload: {
    displayName: string;
    email: string;
    domain?: string;
    bio?: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  },
) => {
  const institutionRole = await resolveOnboardingInstitutionRole(institutionId);
  return createManagedStudentCredentials(institutionId, institutionRole, adminId, payload);
};

export const reviewMentorshipProgram = async (
  adminId: string,
  programId: string,
  payload: AdminMentorshipProgramReviewPayload,
) => {
  const updated = await reviewInstitutionMentorshipProgram(adminId, programId, payload);
  await createAudit(
    adminId,
    payload.decision === 'assigned' ? 'MENTORSHIP_REQUEST_ASSIGNED' : 'MENTORSHIP_REQUEST_REJECTED',
    programId,
    'InstitutionMentorshipProgram',
    {
      status: updated.status,
      institutionId: updated.institution._id,
      ...(updated.mentor ? { mentorId: updated.mentor._id } : {}),
    },
  );
  return updated;
};
