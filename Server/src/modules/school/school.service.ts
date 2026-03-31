import { Types } from 'mongoose';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { Patent } from '../patent/patent.model';
import { ScoreEvent } from '../innovationScore/score.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Event } from '../event/event.model';
import { Workspace } from '../workspace/workspace.model';
import { ComplianceReport } from '../institution/complianceReport.model';
import {
  normalizeInnovationScore,
  normalizeScoreBreakdown,
} from '../innovationScore/score.utils';
import {
  bulkCreateManagedStudentCredentials,
  createManagedStudentCredentials,
  createManagedStudentCredentialsSchema,
  createStudentAccessToken,
  createStudentAccessTokenSchema,
  listPendingStudentVerifications,
  listStudentAccessTokens,
  reviewStudentVerification,
  reviewStudentVerificationSchema,
} from '../institution/institutionAccess.service';
import {
  cancelStudentRosterInvite,
  createStudentRosterEntry,
  importStudentRosterEntries,
  listStudentRosterEntries,
  listStudentRosterQuerySchema,
  manualStudentRosterEntrySchema,
} from '../institution/studentRoster.service';
import {
  DashboardEventView,
  InvestorProfileView,
  LeaderboardPage,
  PendingStudentVerificationView,
  SchoolDashboardPayload,
  SchoolDashboardStats,
  StudentAccessTokenView,
  StudentJourneyPayload,
  StudentLeaderboardItem,
  TemporaryStudentCredentialsView,
  StudentVerificationReviewResult,
} from './school.types';
import { UserRole } from '../../types/roles.types';

const DASHBOARD_TTL_SECONDS = 60 * 10;
const STATS_TTL_SECONDS = 60 * 10;
const INVESTORS_TTL_SECONDS = 60 * 15;
const MAX_TIEBREAKER_EPOCH = 9999999999999;

type StudentLeaderboardCacheUser = {
  _id: Types.ObjectId;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  scoreBreakdown: StudentLeaderboardItem['scoreBreakdown'];
  createdAt: Date;
};

const getInstitutionLeaderboardScore = (score: number, createdAt: Date): number => {
  const tiebreaker = (MAX_TIEBREAKER_EPOCH - createdAt.getTime()) / 1_000_000_000_000_000;
  return score + tiebreaker;
};

const encodeCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');

const decodeCursor = (cursor?: string): number => {
  if (!cursor) {
    return 0;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      offset?: number;
    };
    return typeof parsed.offset === 'number' && parsed.offset >= 0 ? parsed.offset : 0;
  } catch (_error) {
    return 0;
  }
};

const getStudentIdsForInstitution = async (institutionId: string) => {
  const students = await User.find({
    institutionId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id')
    .lean();

  return students.map((student) => student._id);
};

export const rebuildInstitutionLeaderboard = async (institutionId: string): Promise<void> => {
  const students = await User.find({
    institutionId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id innovationScore createdAt')
    .sort({ innovationScore: -1, createdAt: 1 })
    .lean();

  await redis.del(`lb:${institutionId}`);

  if (students.length === 0) {
    return;
  }

  const [firstStudent, ...remainingStudents] = students.map((student) => ({
    member: String(student._id),
    score: getInstitutionLeaderboardScore(normalizeInnovationScore(student.innovationScore), student.createdAt),
  }));

  await redis.zadd(`lb:${institutionId}`, firstStudent, ...remainingStudents);
};

const getWorkspaceMap = async (studentIds: string[]) => {
  const workspaces = await Workspace.find({
    ownerId: { $in: studentIds },
    isActive: true,
  })
    .select('ownerId title stage progressPercent updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  const workspaceMap = new Map<string, StudentLeaderboardItem['activeProject']>();
  for (const workspace of workspaces) {
    const ownerId = String(workspace.ownerId);
    if (!workspaceMap.has(ownerId)) {
      workspaceMap.set(ownerId, {
        title: workspace.title,
        stage: workspace.stage,
        progressPercent: workspace.progressPercent,
      });
    }
  }

  return workspaceMap;
};

const mapLeaderboardUsers = async (
  members: string[],
  offset: number,
): Promise<StudentLeaderboardItem[]> => {
  if (members.length === 0) {
    return [];
  }

  const users = await User.find({
    _id: { $in: members },
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id displayName avatar innovationScore scoreBreakdown createdAt')
    .lean<StudentLeaderboardCacheUser[]>();

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const workspaceMap = await getWorkspaceMap(members);

  return members
    .map((memberId, index) => {
      const user = userMap.get(memberId);
      if (!user) {
        return null;
      }

      const activeProject = workspaceMap.get(memberId);

      return {
        rank: offset + index + 1,
        _id: memberId,
        displayName: user.displayName,
        ...(user.avatar ? { avatar: user.avatar } : {}),
        innovationScore: normalizeInnovationScore(user.innovationScore),
        scoreBreakdown: normalizeScoreBreakdown(user.scoreBreakdown),
        activeSince: user.createdAt.toISOString(),
        ...(activeProject
          ? {
              stage: activeProject.stage,
              activeProject,
            }
          : {}),
      };
    })
    .filter((item): item is StudentLeaderboardItem => item !== null);
};

const getInstitutionUpcomingEvents = async (institutionId: string): Promise<DashboardEventView[]> => {
  const events = await Event.find({
    institutionId,
    scheduledAt: { $gte: new Date() },
    isActive: true,
  })
    .sort({ scheduledAt: 1 })
    .limit(5)
    .lean();

  return events.map((event) => ({
    _id: String(event._id),
    title: event.title,
    type: event.type,
    description: event.description,
    scheduledAt: event.scheduledAt.toISOString(),
    participantsCount: event.participants.length,
  }));
};

export const getDashboardStats = async (institutionId: string): Promise<SchoolDashboardStats> => {
  const cacheKey = `school:stats:${institutionId}`;
  const cached = await redis.get<string>(cacheKey);

  const cachedStats = readRedisJson<SchoolDashboardStats>(cached);
  if (cachedStats) {
    return cachedStats;
  }

  const studentIds = await getStudentIdsForInstitution(institutionId);

  const [totalStudents, totalInnovationActivities, patentsFiled, startupsLaunched, institution] =
    await Promise.all([
      User.countDocuments({ institutionId, role: UserRole.STUDENT, isActive: true }),
      studentIds.length > 0 ? ScoreEvent.countDocuments({ userId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Patent.countDocuments({ studentId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Startup.countDocuments({ founderIds: { $in: studentIds } }) : 0,
      User.findById(institutionId).select('institutionProfile').lean(),
    ]);

  const stats: SchoolDashboardStats = {
    totalStudents,
    totalInnovationActivities,
    patentsFiled,
    totalMentoringHours: institution?.institutionProfile?.stats.totalMentoringHours ?? 0,
    startupsLaunched,
    industryCollaborations:
      institution?.institutionProfile?.stats.industryCollaborations ??
      (await Event.countDocuments({ institutionId })),
  };

  await redis.set(cacheKey, JSON.stringify(stats), { ex: STATS_TTL_SECONDS });

  return stats;
};

export const getStudentLeaderboard = async (
  institutionId: string,
  cursor?: string,
  limit = 50,
): Promise<LeaderboardPage> => {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const offset = decodeCursor(cursor);
  const leaderboardKey = `lb:${institutionId}`;

  const totalMembers = await redis.zcard(leaderboardKey);
  if (totalMembers === 0) {
    await rebuildInstitutionLeaderboard(institutionId);
  }

  const members = await redis.zrange<string[]>(leaderboardKey, offset, offset + safeLimit - 1, {
    rev: true,
  });

  const items = await mapLeaderboardUsers(members, offset);
  const hasMore = offset + members.length < (await redis.zcard(leaderboardKey));

  return {
    items,
    nextCursor: hasMore ? encodeCursor(offset + safeLimit) : null,
  };
};

export const getInvestorDirectory = async (): Promise<InvestorProfileView[]> => {
  const cacheKey = 'school:investors';
  const cached = await redis.get<string>(cacheKey);

  const cachedDirectory = readRedisJson<InvestorProfileView[]>(cached);
  if (cachedDirectory) {
    return cachedDirectory;
  }

  const investors = await User.find({
    role: UserRole.INVESTOR,
    isActive: true,
  })
    .select('_id displayName avatar bio domain email')
    .sort({ updatedAt: -1 })
    .lean();

  const payload = investors.map((investor) => ({
    _id: String(investor._id),
    displayName: investor.displayName,
    ...(investor.avatar ? { avatar: investor.avatar } : {}),
    ...(investor.bio ? { bio: investor.bio } : {}),
    ...(investor.domain ? { domain: investor.domain } : {}),
    contactPreference: investor.email ? `Email: ${investor.email}` : 'Platform intro only',
  }));

  await redis.set(cacheKey, JSON.stringify(payload), { ex: INVESTORS_TTL_SECONDS });

  return payload;
};

export const getStudentJourney = async (
  institutionId: string,
  studentId: string,
): Promise<StudentJourneyPayload> => {
  const student = await User.findOne({
    _id: studentId,
    institutionId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id displayName avatar innovationScore scoreBreakdown')
    .lean();

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found for this institution');
  }

  const [scoreEvents, workspaces, patents, startups] = await Promise.all([
    ScoreEvent.find({ userId: studentId }).sort({ createdAt: -1 }).limit(25).lean(),
    Workspace.find({ ownerId: studentId }).select('title category stage progressPercent updatedAt').lean(),
    Patent.find({ studentId }).select('projectTitle status submittedAt').lean(),
    Startup.find({ founderIds: studentId }).select('name category stage launchedAt').lean(),
  ]);

  return {
    student: {
      _id: String(student._id),
      displayName: student.displayName,
      ...(student.avatar ? { avatar: student.avatar } : {}),
      innovationScore: normalizeInnovationScore(student.innovationScore),
      scoreBreakdown: normalizeScoreBreakdown(student.scoreBreakdown),
    },
    scoreEvents: scoreEvents.map((event) => ({
      _id: String(event._id),
      trigger: event.trigger,
      delta: event.delta,
      scoreAfter: normalizeInnovationScore(event.scoreAfter),
      createdAt: event.createdAt,
    })),
    workspaces: workspaces.map((workspace) => ({
      _id: String(workspace._id),
      title: workspace.title,
      category: workspace.category,
      stage: workspace.stage,
      progressPercent: workspace.progressPercent,
      updatedAt: workspace.updatedAt,
    })),
    patents: patents.map((patent) => ({
      _id: String(patent._id),
      projectTitle: patent.projectTitle,
      status: patent.status,
      submittedAt: patent.submittedAt,
    })),
    startups: startups.map((startup) => ({
      _id: String(startup._id),
      name: startup.name,
      category: startup.category,
      stage: startup.stage,
      ...(startup.launchedAt ? { launchedAt: startup.launchedAt } : {}),
    })),
  };
};

export const getSchoolDashboard = async (institutionId: string): Promise<SchoolDashboardPayload> => {
  const cacheKey = `school:dashboard:${institutionId}`;
  const cached = await redis.get<string>(cacheKey);

  const cachedDashboard = readRedisJson<SchoolDashboardPayload>(cached);
  if (cachedDashboard) {
    return cachedDashboard;
  }

  const institution = await User.findById(institutionId)
    .select('institutionProfile role')
    .lean();

  if (!institution || institution.role !== UserRole.SCHOOL) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'School account not found');
  }

  const studentIds = await getStudentIdsForInstitution(institutionId);
  const rollingWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [stats, topStudentsPage, upcomingEvents, scoreEventsLast30Days, patentsLast30Days, startupsLast30Days] =
    await Promise.all([
      getDashboardStats(institutionId),
      getStudentLeaderboard(institutionId, undefined, 5),
      getInstitutionUpcomingEvents(institutionId),
      studentIds.length > 0
        ? ScoreEvent.countDocuments({
            userId: { $in: studentIds },
            createdAt: { $gte: rollingWindow },
          })
        : 0,
      studentIds.length > 0
        ? Patent.countDocuments({
            studentId: { $in: studentIds },
            createdAt: { $gte: rollingWindow },
          })
        : 0,
      studentIds.length > 0
        ? Startup.countDocuments({
            founderIds: { $in: studentIds },
            createdAt: { $gte: rollingWindow },
          })
        : 0,
    ]);

  const payload: SchoolDashboardPayload = {
    institutionProfile: institution.institutionProfile,
    stats,
    recentActivityCounts: {
      scoreEventsLast30Days,
      patentsLast30Days,
      startupsLast30Days,
    },
    upcomingEvents,
    topStudents: topStudentsPage.items,
  };

  await redis.set(cacheKey, JSON.stringify(payload), { ex: DASHBOARD_TTL_SECONDS });

  return payload;
};

export const getLatestComplianceReport = async (
  institutionId: string,
  institutionType: 'school' | 'college',
) => ComplianceReport.findOne({ institutionId, institutionType }).sort({ generatedAt: -1 }).lean();

export const createSchoolStudentAccessToken = (
  schoolId: string,
  createdBy: string,
  payload: z.infer<typeof createStudentAccessTokenSchema>,
): Promise<StudentAccessTokenView> =>
  createStudentAccessToken(schoolId, UserRole.SCHOOL, createdBy, payload);

export const getSchoolStudentAccessTokens = (
  schoolId: string,
): Promise<StudentAccessTokenView[]> => listStudentAccessTokens(schoolId, UserRole.SCHOOL);

export const getSchoolPendingStudentVerifications = (
  schoolId: string,
): Promise<PendingStudentVerificationView[]> =>
  listPendingStudentVerifications(schoolId, UserRole.SCHOOL);

export const reviewSchoolStudentVerification = (
  schoolId: string,
  reviewerId: string,
  studentId: string,
  payload: z.infer<typeof reviewStudentVerificationSchema>,
): Promise<StudentVerificationReviewResult> =>
  reviewStudentVerification(schoolId, UserRole.SCHOOL, reviewerId, studentId, payload);

export const createSchoolStudentRosterEntry = (
  schoolId: string,
  actorId: string,
  payload: z.infer<typeof manualStudentRosterEntrySchema>,
) => createStudentRosterEntry(schoolId, UserRole.SCHOOL, actorId, payload);

export const cancelSchoolStudentRosterInvite = (
  schoolId: string,
  rosterEntryId: string,
) => cancelStudentRosterInvite(schoolId, UserRole.SCHOOL, rosterEntryId);

export const createSchoolManagedStudentCredentials = (
  schoolId: string,
  actorId: string,
  payload: z.infer<typeof createManagedStudentCredentialsSchema>,
): Promise<TemporaryStudentCredentialsView> =>
  createManagedStudentCredentials(schoolId, UserRole.SCHOOL, actorId, payload);

export const importSchoolStudentRosterEntries = (
  schoolId: string,
  actorId: string,
  file: { originalname: string; buffer: Buffer },
) => importStudentRosterEntries(schoolId, UserRole.SCHOOL, actorId, file);

export const importSchoolStudentCredentials = (
  schoolId: string,
  actorId: string,
  file: { originalname: string; buffer: Buffer },
) => bulkCreateManagedStudentCredentials(schoolId, UserRole.SCHOOL, actorId, file);

export const getSchoolStudentRoster = (
  schoolId: string,
  search?: string,
) => listStudentRosterEntries(schoolId, UserRole.SCHOOL, search);

export {
  createManagedStudentCredentialsSchema,
  createStudentAccessTokenSchema,
  listStudentRosterQuerySchema,
  manualStudentRosterEntrySchema,
  reviewStudentVerificationSchema,
};
