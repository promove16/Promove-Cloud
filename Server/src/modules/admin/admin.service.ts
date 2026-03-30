import { Types } from 'mongoose';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { applyScore, type ScoreTrigger } from '../../services/scoreEngine';
import { NotificationService } from '../notification/notification.service';
import { Patent } from '../patent/patent.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { RegistrationStage } from '../user/user.types';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { Deal } from '../deal/deal.model';
import {
  getInvestmentTypeAnalytics as getDealInvestmentTypeAnalytics,
  getStartupCapTable,
  resetSoleInvestorForStartup,
  updateInvestmentRole,
} from '../deal/deal.service';
import { AdminAuditLog } from './adminAuditLog.model';
import { AdminAward } from './award.model';
import {
  AdminAnalyticsData,
  AdminAwardItem,
  AdminCapacityData,
  AdminDealItem,
  AdminPatentItem,
  AdminRegistrationRequestItem,
  AdminUserListItem,
  AdminUsersResponse,
} from './admin.types';

type AuditAction =
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
  | 'USER_ACTIVATED';

const NON_STUDENT_REGISTRATION_ROLES = new Set<UserRole>([
  UserRole.SCHOOL,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);
const MAX_ADMIN_CREDENTIALS = 3;

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

const createAudit = (adminId: string, action: AuditAction, targetId: string, targetModel: string, metadata?: Record<string, unknown>) =>
  AdminAuditLog.create({
    adminId,
    action,
    targetId,
    targetModel,
    ...(metadata ? { metadata } : {}),
  });

const buildAdminDealItem = (
  deal: {
    _id: Types.ObjectId;
    investorId: Types.ObjectId;
    startupId: Types.ObjectId;
    studentId: Types.ObjectId;
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
  investorType: deal.investorType,
  stage: deal.stage as 1 | 2 | 3 | 4,
  ...(deal.amountINR ? { amountINR: deal.amountINR } : {}),
  ...(deal.equityPercent ? { equityPercent: deal.equityPercent } : {}),
  ...(deal.investorRole ? { investorRole: deal.investorRole } : {}),
  ...(deal.sharesAllocated !== undefined ? { sharesAllocated: deal.sharesAllocated } : {}),
  ...(deal.votingWeight !== undefined ? { votingWeight: deal.votingWeight } : {}),
  ...(deal.canVeto !== undefined ? { canVeto: deal.canVeto } : {}),
  adminApprovalRequired: deal.adminApprovalRequired,
  ...(deal.adminApprovedAt ? { adminApprovedAt: toIso(deal.adminApprovedAt) } : {}),
  ...(deal.adminApprovedBy ? { adminApprovedBy: String(deal.adminApprovedBy) } : {}),
  innovationScoreSnapshot: deal.innovationScoreSnapshot,
  status: deal.status,
  nextActionLabel: deal.adminApprovedAt ? 'Verified by admin' : 'Approve equity transfer',
  investorName,
  startupName,
  studentName,
});

const deleteRefreshTokensForUser = async (userId: string) => {
  const scan = (redis as unknown as {
    scan?: (cursor: string) => Promise<[string, string[]]>;
  }).scan;

  if (typeof scan !== 'function') {
    return;
  }

  let cursor = '0';
  const keysToDelete: string[] = [];

  do {
    const [nextCursor, keys] = await scan(cursor);
    cursor = nextCursor;
    for (const key of keys) {
      if (!key.startsWith('refresh:')) continue;
      const value = await redis.get<string>(key);
      if (value === userId) {
        keysToDelete.push(key);
      }
    }
  } while (cursor !== '0');

  if (keysToDelete.length > 0) {
    await Promise.all(keysToDelete.map((key) => redis.del(key)));
  }
};

const findUser = async (userId: string) => {
  const user = await User.findById(userId).select(
    '_id displayName email role innovationScore isActive profileComplete registrationStage adminApprovalStatus adminApprovalRequestedAt adminApprovedAt adminApprovedBy adminApprovalRejectedAt adminApprovalRejectedReason accessGrantedBy accessExpiresAt createdAt avatar scoreBreakdown institutionProfile',
  );
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
      '_id displayName email role isActive createdAt adminApprovalStatus adminApprovalRequestedAt adminApprovedAt adminApprovalRejectedAt adminApprovalRejectedReason domain bio institutionProfile',
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
  await redis.del(`session:${userId}`);
  await deleteRefreshTokensForUser(userId);
  await createAudit(adminId, 'USER_ROLE_CHANGED', userId, 'User', { previousRole, nextRole: role });
  return userListItem(user.toObject());
};

export const updateUserAccess = async (adminId: string, userId: string, isActive: boolean) => {
  const user = await findUser(userId);
  user.isActive = isActive;
  await user.save();
  await redis.del(`session:${userId}`);
  if (!isActive) {
    await deleteRefreshTokensForUser(userId);
  }
  await createAudit(adminId, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', userId, 'User', { isActive });
  return userListItem(user.toObject());
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
          skillsCompleted: 0,
          progressUploads: 0,
          patentsSubmitted: 0,
          patentsApproved: 0,
          mvpsVerified: 0,
          marketReadyVerified: 0,
          startupsLaunched: 0,
          awardsApproved: 0,
        },
      },
      questionnaire: patent.questionnaire,
    };
  });
};

export const approvePatent = async (adminId: string, patentId: string, trigger: ScoreTrigger) => {
  const patent = await Patent.findById(patentId);
  if (!patent) throw new ApiError(404, 'PATENT_NOT_FOUND', 'Patent not found');
  if (!['submitted', 'under_review'].includes(patent.status)) {
    throw new ApiError(400, 'PATENT_NOT_REVIEWABLE', 'Patent cannot be approved in its current state');
  }

  patent.status = 'approved';
  patent.adminReviewedAt = new Date();
  patent.adminReviewedBy = new Types.ObjectId(adminId);
  patent.scoreAwarded = true;
  await patent.save();

  const newScore = await applyScore({
    userId: String(patent.studentId),
    trigger,
    metadata: { patentId: String(patent._id), adminId },
  });

  await pushNotification(
    String(patent.studentId),
    'patent_status',
    'Patent Approved! +25 Innovation Score',
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

  patent.status = 'rejected';
  patent.adminReviewedAt = new Date();
  patent.adminReviewedBy = new Types.ObjectId(adminId);
  patent.adminNotes = adminNotes;
  await patent.save();

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
      scoreAwarded: award.scoreAwarded,
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
  award.scoreAwarded = true;
  await award.save();

  const newScore = await applyScore({
    userId: String(award.studentId),
    trigger: 'AWARD_APPROVED',
    metadata: { awardId: String(award._id), adminId },
  });

  await pushNotification(
    String(award.studentId),
    'system',
    'Award approved! +15 Innovation Score',
    `${award.title} has been approved by the admin team.`,
  );

  await createAudit(adminId, 'AWARD_APPROVED', String(award._id), 'Award', { studentId: String(award.studentId) });
  return newScore;
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
    adminApprovalRequired: true,
    stage: 3,
    status: { $ne: 'cancelled' },
  }).sort({ createdAt: -1 }).lean();

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

  return deals.map((deal) =>
    buildAdminDealItem(
      deal,
      investorMap.get(String(deal.investorId))?.displayName ?? 'Investor',
      startupMap.get(String(deal.startupId))?.name ?? 'Startup',
      studentMap.get(String(deal.studentId))?.displayName ?? 'Student',
    ),
  );
};

export const getDealAwaitingApproval = async (dealId: string): Promise<AdminDealItem> => {
  const deal = await Deal.findById(dealId).lean();
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const [investor, startup, student] = await Promise.all([
    User.findById(deal.investorId).select('displayName').lean(),
    Startup.findById(deal.startupId).select('name').lean(),
    User.findById(deal.studentId).select('displayName').lean(),
  ]);

  return buildAdminDealItem(
    deal,
    investor?.displayName ?? 'Investor',
    startup?.name ?? 'Startup',
    student?.displayName ?? 'Student',
  );
};

export const approveDealStage = async (adminId: string, dealId: string) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  if (!deal.adminApprovalRequired || deal.stage !== 3) {
    throw new ApiError(400, 'DEAL_NOT_PENDING_APPROVAL', 'Deal is not awaiting admin approval');
  }
  deal.adminApprovedAt = new Date();
  deal.adminApprovedBy = new Types.ObjectId(adminId);
  deal.adminApprovalRequired = false;
  await deal.save();

  const [student, investor] = await Promise.all([
    User.findById(deal.studentId).select('_id displayName').lean(),
    User.findById(deal.investorId).select('_id displayName').lean(),
  ]);

  if (student) {
    await pushNotification(
      String(student._id),
      'system',
      'Equity transfer verified by ProMove admin',
      'Your deal equity has been verified by ProMove admin.',
    );
  }
  if (investor) {
    await pushNotification(
      String(investor._id),
      'system',
      'Equity transfer verified by ProMove admin',
      'You may now close the deal.',
    );
  }

  await createAudit(adminId, 'DEAL_STAGE_APPROVED', String(deal._id), 'Deal', {
    studentId: String(deal.studentId),
    investorId: String(deal.investorId),
  });
};

export const getAdminCapTable = async (startupId: string) => getStartupCapTable(startupId, '', UserRole.ADMIN);

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

  const [users, deals, patents, auditLogs, topInnovators, investmentTypeBreakdown] = await Promise.all([
    User.find({}).select('_id displayName email role innovationScore isActive accessGrantedBy accessExpiresAt createdAt lastLogin').lean(),
    Deal.find({}).select('stage status').lean(),
    Patent.find({}).select('status').lean(),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    User.find({}).sort({ innovationScore: -1 }).limit(5).select('_id displayName email role innovationScore isActive accessGrantedBy accessExpiresAt createdAt').lean(),
    getDealInvestmentTypeAnalytics(),
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
    awardsPending: await AdminAward.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
    investmentTypeBreakdown,
  };

  await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 30 });
  return result;
};

export const getCapacity = async (): Promise<AdminCapacityData> => {
  const max = env.MAX_USERS_YEAR_ONE;
  const current = await User.countDocuments({});
  return {
    current,
    max,
    percentUsed: max > 0 ? Number(((current / max) * 100).toFixed(2)) : 0,
    remainingSlots: Math.max(max - current, 0),
    waitlistCount: Math.max(current - max, 0),
  };
};

export const validateUserAccessQuery = () => undefined;
