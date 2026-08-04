import { Types } from 'mongoose';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Event } from '../event/event.model';
import { JobPost } from '../recruiter/jobPost.model';
import {
  createInstitutionMentorshipProgram,
  listInstitutionMentorshipPrograms,
} from '../mentor/mentorshipProgram.service';
import {
  bulkCreateManagedStudentCredentials,
  createManagedStudentCredentials,
  createManagedStudentCredentialsSchema,
  createStudentAccessToken,
  createStudentAccessTokenSchema,
  listPendingStudentVerifications,
  listStudentAccessTokens,
  previewManagedStudentCredentialsImport,
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
  getDashboardStats,
  getInvestorDirectory,
  getInstitutionTrendGraph,
  getInstitutionUpcomingEvents,
  getInnovationScoreDistribution,
  getLatestComplianceReport,
  getRecentActivityCounts,
  getRecentInstitutionProjects,
  listInstitutionPatents,
  listInstitutionProjects,
  listInstitutionStartups,
  getStudentJourney,
  getStudentLeaderboard,
} from '../school/school.service';
import {
  calculateEstimatedIicRating,
  getInstitutionIicTelemetry,
} from '../institution/iicRating.service';
import {
  InstitutionTrendGraph,
  InstitutionTrendSeries,
  TemporaryStudentCredentialsView,
} from '../school/school.types';
import { PlacementRecord } from './placementRecord.model';
import {
  CollegeDashboardPayload,
  CollegeDashboardStats,
  EventListItem,
  HiringPartner,
  PendingStudentVerificationView,
  PlacementStatusUpdateResult,
  PlacementTrackerPayload,
  RecruiterDirectoryItem,
  StudentAccessTokenView,
  StudentVerificationReviewResult,
} from './college.types';
import {
  addSubmissionScore,
  computeEventRankings,
  createEvent,
  createEventSchema,
  getEventRankings,
  listCollegeHiringEvents as listCollegeHiringEventsService,
  listInstitutionEvents,
} from '../event/event.service';

export const placementStatusSchema = z.object({
  status: z.enum(['Shortlisted', 'Hired', 'Rejected']),
});

const getCollegeStudentIds = async (collegeId: string) => {
  const students = await User.find({
    institutionId: collegeId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id')
    .lean();

  return students.map((student) => student._id);
};

export const getRecruiterDirectory = async (collegeId?: string): Promise<RecruiterDirectoryItem[]> => {
  const cacheKey = `college:recruiters:${collegeId ?? 'all'}`;
  const cached = await redis.get<string>(cacheKey);
  const cachedDirectory = readRedisJson<RecruiterDirectoryItem[]>(cached);
  if (cachedDirectory) {
    return cachedDirectory;
  }

  const [placementRecords, activeEvents] = await Promise.all([
    PlacementRecord.find({
      ...(collegeId ? { collegeId } : {}),
      recruiterId: { $exists: true },
    })
      .select('recruiterId collegeId status')
      .lean(),
    Event.find({
      category: 'hiring',
      isActive: true,
      ...(collegeId ? { institutionId: collegeId } : {}),
    })
      .select('recruiterId institutionId')
      .lean(),
  ]);

  const relevantRecruiterIds = Array.from(
    new Set(
      [...placementRecords, ...activeEvents]
        .map((entry) => entry.recruiterId)
        .filter((recruiterId): recruiterId is NonNullable<typeof recruiterId> => Boolean(recruiterId))
        .map((recruiterId) => String(recruiterId)),
    ),
  );

  if (relevantRecruiterIds.length === 0) {
    await redis.set(cacheKey, JSON.stringify([]), { ex: 60 * 15 });
    return [];
  }

  const recruiters = await User.find({
    _id: { $in: relevantRecruiterIds },
    role: UserRole.RECRUITER,
    isActive: true,
  })
    .select('_id displayName avatar domain')
    .sort({ updatedAt: -1 })
    .lean();

  const recruiterIds = recruiters.map((recruiter) => recruiter._id);
  const activeJobs =
    recruiterIds.length > 0
      ? await JobPost.find({
          recruiterId: { $in: recruiterIds },
          isActive: true,
        })
          .select('recruiterId')
          .lean()
      : [];

  const activeJobCountByRecruiter = new Map<string, number>();
  for (const job of activeJobs) {
    const key = String(job.recruiterId);
    activeJobCountByRecruiter.set(key, (activeJobCountByRecruiter.get(key) ?? 0) + 1);
  }

  const activeEventCountByRecruiter = new Map<string, number>();
  for (const event of activeEvents) {
    const key = String(event.recruiterId);
    activeEventCountByRecruiter.set(key, (activeEventCountByRecruiter.get(key) ?? 0) + 1);
  }

  const payload = recruiters.map((recruiter) => {
    const recruiterId = String(recruiter._id);
    const activePositions = activeJobCountByRecruiter.get(recruiterId) ?? 0;
    const eventCount = activeEventCountByRecruiter.get(recruiterId) ?? 0;

    return {
      _id: recruiterId,
      displayName: recruiter.displayName,
      ...(recruiter.avatar ? { avatar: recruiter.avatar } : {}),
      company: recruiter.domain ? `${recruiter.domain} Hiring` : 'Campus Hiring Partner',
      activePositions,
      activeDrives: eventCount,
      domains: recruiter.domain ? [recruiter.domain] : [],
    };
  })
    .filter((recruiter) => recruiter.activePositions > 0 || recruiter.activeDrives > 0 || matchingCollegeActivityExists(placementRecords, recruiter._id))
    .sort((left, right) =>
      right.activePositions - left.activePositions ||
      right.activeDrives - left.activeDrives ||
      left.displayName.localeCompare(right.displayName),
    );

  await redis.set(cacheKey, JSON.stringify(payload), { ex: 60 * 15 });

  return payload;
};

const matchingCollegeActivityExists = (
  placementRecords: Array<{ recruiterId?: unknown }>,
  recruiterId: string,
) => placementRecords.some((record) => String(record.recruiterId) === recruiterId);

const getPlacementTracker = async (collegeId: string): Promise<PlacementTrackerPayload> => {
  const studentIds = await getCollegeStudentIds(collegeId);
  const records =
    studentIds.length > 0
      ? await PlacementRecord.find({ collegeId })
          .sort({ updatedAt: -1 })
          .lean()
      : [];

  const studentMap = new Map(
    (
      await User.find({ _id: { $in: studentIds } })
        .select('_id displayName avatar innovationScore')
        .lean()
    ).map((student) => [String(student._id), student]),
  );

  const recruiterIds = records
    .map((record) => record.recruiterId)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const recruiterMap = new Map(
    (
      recruiterIds.length > 0
        ? await User.find({ _id: { $in: recruiterIds } }).select('_id displayName domain avatar').lean()
        : []
    ).map((recruiter) => [String(recruiter._id), recruiter]),
  );

  const placementTable = records
    .map((record) => {
      const student = studentMap.get(String(record.studentId));
      if (!student) {
        return null;
      }

      const recruiter = record.recruiterId ? recruiterMap.get(String(record.recruiterId)) : undefined;

      return {
        _id: String(record._id),
        studentId: String(record.studentId),
        studentName: student.displayName,
        ...(student.avatar ? { studentAvatar: student.avatar } : {}),
        ...(record.recruiterId ? { recruiterId: String(record.recruiterId) } : {}),
        ...(recruiter ? { recruiterName: recruiter.displayName } : {}),
        ...(record.companyName ? { companyName: record.companyName } : {}),
        innovationScore: student.innovationScore ?? record.innovationScoreAtTime,
        status: record.status,
        updatedAt: record.updatedAt.toISOString(),
      };
    })
    .filter((record): record is PlacementTrackerPayload['placementTable'][number] => record !== null)
    .sort((left, right) => {
      const statusOrder = ['Hired', 'Shortlisted', 'In Progress', 'Discovered', 'Rejected'];
      const statusDiff =
        statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return right.innovationScore - left.innovationScore;
    });

  const recruiterDirectory = await getRecruiterDirectory(collegeId);
  const studentsPlaced = placementTable.filter((record) => record.status === 'Hired').length;
  const totalInnovators = studentIds.length;

  const hiringPartners: HiringPartner[] = recruiterDirectory.map((recruiter) => ({
    _id: recruiter._id,
    displayName: recruiter.displayName,
    ...(recruiter.avatar ? { avatar: recruiter.avatar } : {}),
    company: recruiter.company,
    openPositions: recruiter.activePositions,
    activeDrives: recruiter.activeDrives,
    domains: recruiter.domains,
  }));

  return {
    placementVelocity:
      totalInnovators > 0 ? Number(((studentsPlaced / totalInnovators) * 100).toFixed(2)) : 0,
    totalInnovators,
    studentsPlaced,
    hiringPartners,
    placementTable,
  };
};

const getCollegePlacementTrendSeries = async (
  collegeId: string,
  labels: string[],
): Promise<InstitutionTrendSeries> => {
  if (labels.length === 0) {
    return { label: 'Placements', color: '#a78bfa', values: [] };
  }

  const startDate = new Date(`${labels[0]}T00:00:00.000Z`);
  const counts = await PlacementRecord.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        collegeId: new Types.ObjectId(collegeId),
        status: { $in: ['Shortlisted', 'Hired'] },
        updatedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const countMap = new Map(counts.map((entry) => [entry._id, entry.count]));

  return {
    label: 'Placements',
    color: '#a78bfa',
    values: labels.map((label) => countMap.get(label) ?? 0),
  };
};

export const getCollegeDashboard = async (institutionId: string): Promise<CollegeDashboardPayload> => {
  const cacheKey = `college:dashboard:v3:${institutionId}`;
  const cached = await redis.get<string>(cacheKey);

  const cachedDashboard = readRedisJson<CollegeDashboardPayload>(cached);
  if (cachedDashboard) {
    return cachedDashboard;
  }

  const institution = await User.findById(institutionId)
    .select('institutionProfile role')
    .lean();

  if (!institution || institution.role !== UserRole.COLLEGE) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'College account not found');
  }

  const studentIds = await getCollegeStudentIds(institutionId);

  const [
    schoolStats,
    placement,
    topStudentsPage,
    upcomingEvents,
    recentActivityCounts,
    recentProjects,
    schoolTrendGraph,
    innovationScoreDistribution,
    iicTelemetry,
  ] = await Promise.all([
    getDashboardStats(institutionId, studentIds),
    getPlacementTracker(institutionId),
    getStudentLeaderboard(institutionId, undefined, 5),
    getInstitutionUpcomingEvents(institutionId),
    getRecentActivityCounts(studentIds),
    getRecentInstitutionProjects(studentIds),
    getInstitutionTrendGraph(studentIds),
    getInnovationScoreDistribution(institutionId, studentIds),
    getInstitutionIicTelemetry(institutionId, 'college'),
  ]);

  const stats: CollegeDashboardStats = {
    ...schoolStats,
    studentsPlaced: placement.studentsPlaced,
    activeHRPartners: placement.hiringPartners.length,
    placementVelocity: placement.placementVelocity,
  };
  const placementTrendSeries = await getCollegePlacementTrendSeries(
    institutionId,
    schoolTrendGraph.labels,
  );
  const trendGraph: InstitutionTrendGraph = {
    labels: schoolTrendGraph.labels,
    rangeDays: schoolTrendGraph.rangeDays,
    series: [
      schoolTrendGraph.series.find((item) => item.label === 'Innovation Activities') ?? {
        label: 'Innovation Activities',
        color: '#38bdf8',
        values: schoolTrendGraph.labels.map(() => 0),
      },
      schoolTrendGraph.series.find((item) => item.label === 'Project Updates') ?? {
        label: 'Project Updates',
        color: '#34d399',
        values: schoolTrendGraph.labels.map(() => 0),
      },
      placementTrendSeries,
      schoolTrendGraph.series.find((item) => item.label === 'Startups Launched') ?? {
        label: 'Startups Launched',
        color: '#f472b6',
        values: schoolTrendGraph.labels.map(() => 0),
      },
    ],
  };

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

  const payload: CollegeDashboardPayload = {
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
            totalHRConnections: placement.hiringPartners.length,
            studentsPlaced: placement.studentsPlaced,
            directShortlistsThisQuarter: placement.placementTable.filter((item) => item.status === 'Shortlisted').length,
            topHiringSector: placement.hiringPartners[0]?.domains[0],
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

  await redis.set(cacheKey, JSON.stringify(payload), { ex: 60 * 10 });

  return payload;
};

export const getCollegePlacementTracker = (collegeId: string) => getPlacementTracker(collegeId);

export const updatePlacementStatus = async (
  recruiterId: string,
  studentId: string,
  status: 'Shortlisted' | 'Hired' | 'Rejected',
): Promise<PlacementStatusUpdateResult> => {
  const [student, recruiter] = await Promise.all([
    User.findById(studentId).select('_id displayName institutionId innovationScore role').lean(),
    User.findById(recruiterId).select('_id displayName domain role').lean(),
  ]);

  if (!student || student.role !== UserRole.STUDENT || !student.institutionId) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const college = await User.findById(student.institutionId).select('_id displayName role').lean();
  if (!college || college.role !== UserRole.COLLEGE) {
    throw new ApiError(400, 'COLLEGE_NOT_FOUND', 'Student is not attached to a college');
  }

  if (!recruiter || recruiter.role !== UserRole.RECRUITER) {
    throw new ApiError(403, 'FORBIDDEN', 'Only recruiters can update placement status');
  }

  const record = await PlacementRecord.findOneAndUpdate(
    {
      studentId,
      collegeId: college._id,
    },
    {
      studentId,
      collegeId: college._id,
      recruiterId,
      companyName: recruiter.domain ? `${recruiter.domain} Hiring` : recruiter.displayName,
      status,
      innovationScoreAtTime: student.innovationScore ?? 0,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (status === 'Hired') {
    await Promise.all([
      NotificationService.create({
        userId: String(student._id),
        type: 'system',
        title: 'Placement update',
        body: `${recruiter.displayName} marked your status as Hired.`,
        link: '/dashboard/college/placement',
      }),
      NotificationService.create({
        userId: String(college._id),
        type: 'system',
        title: 'Student hired',
        body: `${student.displayName} has been hired through ProMove.`,
        link: '/dashboard/college/placement',
      }),
    ]);
  }

  return {
    _id: String(record._id),
    status: record.status,
    ...(record.companyName ? { companyName: record.companyName } : {}),
    ...(record.recruiterId ? { recruiterId: String(record.recruiterId) } : {}),
    updatedAt: record.updatedAt.toISOString(),
  };
};

export const createCollegeEvent = (
  collegeId: string,
  createdBy: string,
  payload: z.infer<typeof createEventSchema>,
) => createEvent(collegeId, createdBy, payload);

export const listCollegeEvents = async (collegeId: string): Promise<EventListItem[]> => {
  const events = await listInstitutionEvents(collegeId);
  const rankings = await Promise.all(
    events.map(async (event) => ({
      eventId: event._id,
      rankings: await getEventRankings(event._id, collegeId),
    })),
  );
  const rankingMap = new Map(rankings.map((entry) => [entry.eventId, entry.rankings]));

  return events.map((event) => ({
    ...event,
    rankings: rankingMap.get(event._id) ?? [],
  }));
};

export const addCollegeEventSubmissionScore = addSubmissionScore;
export const computeCollegeEventRankings = computeEventRankings;
export const getCollegeEventRankings = getEventRankings;
export const getCollegeHiringEvents = (collegeId: string) => listCollegeHiringEventsService(collegeId);
export const getCollegeInvestors = getInvestorDirectory;
export const getCollegeProjects = (collegeId: string) => listInstitutionProjects(collegeId);
export const getCollegePatents = (collegeId: string) => listInstitutionPatents(collegeId);
export const getCollegeStartups = (collegeId: string) => listInstitutionStartups(collegeId);
export const getCollegeStudentJourney = getStudentJourney;
export const getCollegeStudentLeaderboard = getStudentLeaderboard;
export const getLatestCollegeComplianceReport = (institutionId: string) =>
  getLatestComplianceReport(institutionId, 'college');
export const getLatestSchoolComplianceReport = (institutionId: string) =>
  getLatestComplianceReport(institutionId, 'school');

export const createCollegeStudentAccessToken = (
  collegeId: string,
  createdBy: string,
  payload: z.infer<typeof createStudentAccessTokenSchema>,
): Promise<StudentAccessTokenView> =>
  createStudentAccessToken(collegeId, UserRole.COLLEGE, createdBy, payload);

export const getCollegeStudentAccessTokens = (
  collegeId: string,
): Promise<StudentAccessTokenView[]> => listStudentAccessTokens(collegeId, UserRole.COLLEGE);

export const getCollegePendingStudentVerifications = (
  collegeId: string,
): Promise<PendingStudentVerificationView[]> =>
  listPendingStudentVerifications(collegeId, UserRole.COLLEGE);

export const reviewCollegeStudentVerification = (
  collegeId: string,
  reviewerId: string,
  studentId: string,
  payload: z.infer<typeof reviewStudentVerificationSchema>,
): Promise<StudentVerificationReviewResult> =>
  reviewStudentVerification(collegeId, UserRole.COLLEGE, reviewerId, studentId, payload);

export const createCollegeStudentRosterEntry = async (
  collegeId: string,
  actorId: string,
  payload: z.infer<typeof manualStudentRosterEntrySchema>,
) => createStudentRosterEntry(collegeId, UserRole.COLLEGE, actorId, payload);

export const cancelCollegeStudentRosterInvite = (
  collegeId: string,
  rosterEntryId: string,
) => cancelStudentRosterInvite(collegeId, UserRole.COLLEGE, rosterEntryId);

export const createCollegeManagedStudentCredentials = (
  collegeId: string,
  actorId: string,
  payload: z.infer<typeof createManagedStudentCredentialsSchema>,
): Promise<TemporaryStudentCredentialsView> =>
  createManagedStudentCredentials(collegeId, UserRole.COLLEGE, actorId, payload);

export const importCollegeStudentRosterEntries = async (
  collegeId: string,
  actorId: string,
  file: { originalname: string; buffer: Buffer },
) => importStudentRosterEntries(collegeId, UserRole.COLLEGE, actorId, file);

export const importCollegeStudentCredentials = (
  collegeId: string,
  actorId: string,
  file: { originalname: string; buffer: Buffer },
) => bulkCreateManagedStudentCredentials(collegeId, UserRole.COLLEGE, actorId, file);

export const previewCollegeStudentCredentials = (
  collegeId: string,
  file: { originalname: string; buffer: Buffer },
) => previewManagedStudentCredentialsImport(collegeId, UserRole.COLLEGE, file);

export const getCollegeStudentRoster = (
  collegeId: string,
  search?: string,
) => listStudentRosterEntries(collegeId, UserRole.COLLEGE, search);

export const createCollegeMentorshipProgramRequest = (
  collegeId: string,
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
) => createInstitutionMentorshipProgram(collegeId, 'college', requestedBy, payload);

export const getCollegeMentorshipPrograms = (collegeId: string) =>
  listInstitutionMentorshipPrograms(collegeId, 'college');

export const getCollegeDrivesForCollege = (collegeId: string) => listCollegeHiringEventsService(collegeId);

export {
  createManagedStudentCredentialsSchema,
  createStudentAccessTokenSchema,
  listStudentRosterQuerySchema,
  manualStudentRosterEntrySchema,
  reviewStudentVerificationSchema,
};
