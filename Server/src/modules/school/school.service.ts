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
import { InstitutionMentorshipProgram } from '../mentor/mentorshipProgram.model';
import {
  createInstitutionMentorshipProgram,
  listInstitutionMentorshipPrograms,
} from '../mentor/mentorshipProgram.service';
import { Workspace } from '../workspace/workspace.model';
import { ComplianceReport } from '../institution/complianceReport.model';
import {
  calculateEstimatedIicRating,
  getInstitutionIicTelemetry,
} from '../institution/iicRating.service';
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
  InnovationScoreDistributionBucket,
  DashboardEventView,
  InstitutionPatentView,
  InstitutionStartupView,
  InvestorProfileView,
  InstitutionTrendGraph,
  InstitutionTrendSeries,
  LeaderboardPage,
  PendingStudentVerificationView,
  RecentActivityCounts,
  RecentProjectView,
  SchoolDashboardPayload,
  SchoolDashboardStats,
  StudentAccessTokenView,
  StudentJourneyPayload,
  StudentLeaderboardItem,
  TemporaryStudentCredentialsView,
  StudentVerificationReviewResult,
} from './school.types';
import { UserRole } from '../../types/roles.types';
import type { EventListItem } from '../college/college.types';
import {
  createEvent,
  createEventSchema,
  getEventRankings,
  listInstitutionEvents,
} from '../event/event.service';

const DASHBOARD_TTL_SECONDS = 60 * 10;
const STATS_TTL_SECONDS = 60 * 10;
const INVESTORS_TTL_SECONDS = 60 * 15;
const MAX_TIEBREAKER_EPOCH = 9999999999999;
const TREND_RANGE_DAYS = 30;
const INNOVATION_SCORE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-250', min: 0, max: 250 },
  { label: '251-500', min: 251, max: 500 },
  { label: '501-750', min: 501, max: 750 },
  { label: '751-1000', min: 751, max: 1000 },
];

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

const countRecentInstitutionActivity = async (
  studentIds: Types.ObjectId[],
): Promise<RecentActivityCounts> => {
  if (studentIds.length === 0) {
    return {
      scoreEventsLast30Days: 0,
      patentsLast30Days: 0,
      startupsLast30Days: 0,
    };
  }

  const rollingWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [scoreEventsLast30Days, patentsLast30Days, startupsLast30Days] = await Promise.all([
    ScoreEvent.countDocuments({
      userId: { $in: studentIds },
      createdAt: { $gte: rollingWindow },
    }),
    Patent.countDocuments({
      studentId: { $in: studentIds },
      createdAt: { $gte: rollingWindow },
    }),
    Startup.countDocuments({
      founderIds: { $in: studentIds },
      createdAt: { $gte: rollingWindow },
    }),
  ]);

  return {
    scoreEventsLast30Days,
    patentsLast30Days,
    startupsLast30Days,
  };
};

const buildTrendLabels = (rangeDays: number) => {
  const labels: string[] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));

  for (let index = 0; index < rangeDays; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    labels.push(day.toISOString().slice(0, 10));
  }

  return { labels, startDate: start };
};

const mergeTrendCounts = (
  labels: string[],
  counts: Array<{ _id: string; count: number }>,
): number[] => {
  const countMap = new Map(counts.map((entry) => [entry._id, entry.count]));
  return labels.map((label) => countMap.get(label) ?? 0);
};

const aggregateCountByDay = async (
  aggregatePromise: Promise<Array<{ _id: string; count: number }>>,
): Promise<Array<{ _id: string; count: number }>> => aggregatePromise;

export const getInstitutionTrendGraph = async (
  studentIds: Types.ObjectId[],
  rangeDays = TREND_RANGE_DAYS,
): Promise<InstitutionTrendGraph> => {
  const { labels, startDate } = buildTrendLabels(rangeDays);

  if (studentIds.length === 0) {
    return {
      labels,
      rangeDays,
      series: [
        { label: 'Innovation Activities', color: '#38bdf8', values: labels.map(() => 0) },
        { label: 'Project Updates', color: '#34d399', values: labels.map(() => 0) },
        { label: 'Patents Filed', color: '#f59e0b', values: labels.map(() => 0) },
        { label: 'Startups Launched', color: '#f472b6', values: labels.map(() => 0) },
      ],
    };
  }

  const [activityCounts, projectCounts, patentCounts, startupCounts] = await Promise.all([
    aggregateCountByDay(
      ScoreEvent.aggregate<{ _id: string; count: number }>([
        { $match: { userId: { $in: studentIds }, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ),
    aggregateCountByDay(
      Workspace.aggregate<{ _id: string; count: number }>([
        { $match: { ownerId: { $in: studentIds }, isActive: true, updatedAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ),
    aggregateCountByDay(
      Patent.aggregate<{ _id: string; count: number }>([
        { $match: { studentId: { $in: studentIds }, submittedAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ),
    aggregateCountByDay(
      Startup.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            founderIds: { $in: studentIds },
            $or: [{ launchedAt: { $gte: startDate } }, { createdAt: { $gte: startDate } }],
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $ifNull: ['$launchedAt', '$createdAt'] },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ),
  ]);

  const series: InstitutionTrendSeries[] = [
    { label: 'Innovation Activities', color: '#38bdf8', values: mergeTrendCounts(labels, activityCounts) },
    { label: 'Project Updates', color: '#34d399', values: mergeTrendCounts(labels, projectCounts) },
    { label: 'Patents Filed', color: '#f59e0b', values: mergeTrendCounts(labels, patentCounts) },
    { label: 'Startups Launched', color: '#f472b6', values: mergeTrendCounts(labels, startupCounts) },
  ];

  return {
    labels,
    rangeDays,
    series,
  };
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

export const getInstitutionUpcomingEvents = async (institutionId: string): Promise<DashboardEventView[]> => {
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

export const getInnovationScoreDistribution = async (
  institutionId: string,
  studentIdsInput?: Types.ObjectId[],
): Promise<InnovationScoreDistributionBucket[]> => {
  const studentIds = studentIdsInput ?? (await getStudentIdsForInstitution(institutionId));

  if (studentIds.length === 0) {
    return INNOVATION_SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  }

  const students = await User.find({
    _id: { $in: studentIds },
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('innovationScore')
    .lean();

  const counts = INNOVATION_SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));

  for (const student of students) {
    const score = normalizeInnovationScore(student.innovationScore);
    const matchingBucket = counts.find((bucket) => score >= bucket.min && score <= bucket.max);
    if (matchingBucket) {
      matchingBucket.count += 1;
    }
  }

  return counts;
};

export const createSchoolEvent = (
  schoolId: string,
  createdBy: string,
  payload: z.infer<typeof createEventSchema>,
) => createEvent(schoolId, createdBy, payload);

export const listSchoolEvents = async (schoolId: string): Promise<EventListItem[]> => {
  const events = await listInstitutionEvents(schoolId);
  const rankings = await Promise.all(
    events.map(async (event) => ({
      eventId: event._id,
      rankings: await getEventRankings(event._id, schoolId),
    })),
  );
  const rankingMap = new Map(rankings.map((entry) => [entry.eventId, entry.rankings]));

  return events.map((event) => ({
    ...event,
    rankings: rankingMap.get(event._id) ?? [],
  }));
};

export const getSchoolEventRankings = getEventRankings;

export const getDashboardStats = async (
  institutionId: string,
  studentIdsInput?: Types.ObjectId[],
): Promise<SchoolDashboardStats> => {
  const cacheKey = `school:stats:${institutionId}`;
  const shouldUseCache = !studentIdsInput;
  const cached = shouldUseCache ? await redis.get<string>(cacheKey) : null;

  const cachedStats = readRedisJson<SchoolDashboardStats>(cached);
  if (cachedStats) {
    return cachedStats;
  }

  const studentIds = studentIdsInput ?? (await getStudentIdsForInstitution(institutionId));

  const [
    totalStudents,
    activeProjects,
    totalInnovationActivities,
    patentsFiled,
    startupsLaunched,
    institution,
    completedMentoringMinutes,
  ] =
    await Promise.all([
      User.countDocuments({ institutionId, role: UserRole.STUDENT, isActive: true }),
      studentIds.length > 0 ? Workspace.countDocuments({ ownerId: { $in: studentIds }, isActive: true }) : 0,
      studentIds.length > 0 ? ScoreEvent.countDocuments({ userId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Patent.countDocuments({ studentId: { $in: studentIds } }) : 0,
      studentIds.length > 0 ? Startup.countDocuments({ founderIds: { $in: studentIds } }) : 0,
      User.findById(institutionId).select('institutionProfile').lean(),
      InstitutionMentorshipProgram.aggregate<{ totalMinutes: number }>([
        {
          $match: {
            institutionId: new Types.ObjectId(institutionId),
            status: 'Assigned',
            scheduledAt: { $lte: new Date() },
          },
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: '$durationMinutes' },
          },
        },
      ]).then((rows) => rows[0]?.totalMinutes ?? 0),
    ]);

  const stats: SchoolDashboardStats = {
    totalStudents,
    activeProjects,
    totalInnovationActivities,
    patentsFiled,
    totalMentoringHours:
      Number((completedMentoringMinutes / 60).toFixed(1)) ||
      institution?.institutionProfile?.stats.totalMentoringHours ||
      0,
    startupsLaunched,
    industryCollaborations:
      institution?.institutionProfile?.stats.industryCollaborations ??
      (await Event.countDocuments({ institutionId })),
  };

  if (shouldUseCache) {
    await redis.set(cacheKey, JSON.stringify(stats), { ex: STATS_TTL_SECONDS });
  }

  return stats;
};

export const getRecentInstitutionProjects = async (
  studentIds: Types.ObjectId[],
  limit = 4,
): Promise<RecentProjectView[]> => {
  if (studentIds.length === 0) {
    return [];
  }

  const workspaces = await Workspace.find({
    ownerId: { $in: studentIds },
    isActive: true,
  })
    .select('_id ownerId title category stage progressPercent updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  if (workspaces.length === 0) {
    return [];
  }

  const studentMap = new Map(
    (
      await User.find({ _id: { $in: workspaces.map((workspace) => workspace.ownerId) } })
        .select('_id displayName')
        .lean()
    ).map((student) => [String(student._id), student.displayName]),
  );

  return workspaces.map((workspace) => ({
    _id: String(workspace._id),
    studentId: String(workspace.ownerId),
    studentName: studentMap.get(String(workspace.ownerId)) ?? 'Student',
    title: workspace.title,
    category: workspace.category,
    stage: workspace.stage,
    progressPercent: workspace.progressPercent,
    updatedAt: workspace.updatedAt.toISOString(),
  }));
};

export const getRecentActivityCounts = (studentIds: Types.ObjectId[]) =>
  countRecentInstitutionActivity(studentIds);

export const listInstitutionProjects = async (
  institutionId: string,
  limit = 50,
): Promise<RecentProjectView[]> => {
  const studentIds = await getStudentIdsForInstitution(institutionId);
  return getRecentInstitutionProjects(studentIds, limit);
};

export const listInstitutionPatents = async (
  institutionId: string,
  limit = 50,
): Promise<InstitutionPatentView[]> => {
  const studentIds = await getStudentIdsForInstitution(institutionId);

  if (studentIds.length === 0) {
    return [];
  }

  const patents = await Patent.find({
    studentId: { $in: studentIds },
  })
    .select('_id studentId projectTitle status submittedAt')
    .sort({ submittedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  const studentMap = new Map(
    (
      await User.find({ _id: { $in: patents.map((patent) => patent.studentId) } })
        .select('_id displayName')
        .lean()
    ).map((student) => [String(student._id), student.displayName]),
  );

  return patents.map((patent) => ({
    _id: String(patent._id),
    studentId: String(patent.studentId),
    studentName: studentMap.get(String(patent.studentId)) ?? 'Student',
    projectTitle: patent.projectTitle,
    status: patent.status,
    submittedAt: patent.submittedAt.toISOString(),
  }));
};

export const listInstitutionStartups = async (
  institutionId: string,
  limit = 50,
): Promise<InstitutionStartupView[]> => {
  const studentIds = await getStudentIdsForInstitution(institutionId);

  if (studentIds.length === 0) {
    return [];
  }

  const startups = await Startup.find({
    founderIds: { $in: studentIds },
    isActive: true,
  })
    .select('name tagline category stage founderIds activeProducts teamSize reviewStatus launchedAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const founderMap = new Map(
    (
      await User.find({
        _id: {
          $in: startups.flatMap((startup) => startup.founderIds),
        },
      })
        .select('_id displayName')
        .lean()
    ).map((founder) => [String(founder._id), founder.displayName]),
  );

  return startups.map((startup) => ({
    _id: String(startup._id),
    name: startup.name,
    tagline: startup.tagline,
    category: startup.category,
    stage: startup.stage,
    founderNames: startup.founderIds
      .map((founderId) => founderMap.get(String(founderId)))
      .filter((name): name is string => Boolean(name)),
    activeProducts: startup.activeProducts,
    teamSize: startup.teamSize,
    reviewStatus: startup.reviewStatus ?? 'draft',
    ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
    updatedAt: startup.updatedAt.toISOString(),
  }));
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
  const cacheKey = `school:dashboard:v3:${institutionId}`;
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
  const [
    stats,
    topStudentsPage,
    upcomingEvents,
    recentActivityCounts,
    recentProjects,
    trendGraph,
    innovationScoreDistribution,
    iicTelemetry,
  ] =
    await Promise.all([
      getDashboardStats(institutionId, studentIds),
      getStudentLeaderboard(institutionId, undefined, 5),
      getInstitutionUpcomingEvents(institutionId),
      getRecentActivityCounts(studentIds),
      getRecentInstitutionProjects(studentIds),
      getInstitutionTrendGraph(studentIds),
      getInnovationScoreDistribution(institutionId, studentIds),
      getInstitutionIicTelemetry(institutionId, 'school'),
    ]);

  const iicRating = calculateEstimatedIicRating({
    totalStudents: stats.totalStudents,
    activeProjects: stats.activeProjects,
    totalInnovationActivities: stats.totalInnovationActivities,
    patentsFiled: stats.patentsFiled,
    totalMentoringHours: stats.totalMentoringHours,
    startupsLaunched: stats.startupsLaunched,
    industryCollaborations: stats.industryCollaborations,
    structuredActivityCount: iicTelemetry.structuredActivityCount,
    activeQuarterCount: iicTelemetry.activeQuarterCount,
    policies: institution.institutionProfile?.policies ?? [],
  });

  const payload: SchoolDashboardPayload = {
    institutionProfile: institution.institutionProfile
      ? {
          ...institution.institutionProfile,
          iicStarRating: iicRating.starRating,
          iicLastUpdated: new Date(),
          stats: {
            ...institution.institutionProfile.stats,
            totalInnovationActivities: stats.totalInnovationActivities,
            patentsFiled: stats.patentsFiled,
            totalMentoringHours: stats.totalMentoringHours,
            startupsLaunched: stats.startupsLaunched,
            industryCollaborations: stats.industryCollaborations,
          },
        }
      : undefined,
    stats,
    recentActivityCounts,
    trendGraph,
    innovationScoreDistribution,
    upcomingEvents,
    topStudents: topStudentsPage.items,
    recentProjects,
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

export const createSchoolStudentRosterEntry = async (
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

export const importSchoolStudentRosterEntries = async (
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

export const createSchoolMentorshipProgramRequest = (
  schoolId: string,
  requestedBy: string,
  payload: {
    title: string;
    objective: string;
    preferredDate: string;
    durationMinutes: number;
    expectedParticipants: number;
    deliveryMode: 'Online' | 'Offline';
    platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
    meetingLink?: string;
    venue?: string;
  },
) => createInstitutionMentorshipProgram(schoolId, 'school', requestedBy, payload);

export const getSchoolMentorshipPrograms = (schoolId: string) =>
  listInstitutionMentorshipPrograms(schoolId, 'school');

export {
  createManagedStudentCredentialsSchema,
  createStudentAccessTokenSchema,
  listStudentRosterQuerySchema,
  manualStudentRosterEntrySchema,
  reviewStudentVerificationSchema,
};
