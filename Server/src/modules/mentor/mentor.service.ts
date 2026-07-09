import { Types } from 'mongoose';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { NotificationService } from '../notification/notification.service';
import { Patent } from '../patent/patent.model';
import { ScoreEvent } from '../innovationScore/score.model';
import { ProfileView } from '../social/profileView.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { queueMentorViewedProfileEmail } from '../../services/retentionEmailService';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { MentorSession } from './mentorSession.model';
import { MentorFeedback } from './mentorFeedback.model';
import { MentorBid } from './mentorBid.model';
import { Problem } from '../problemBank/problem.model';
import {
  assertMentorAvailability,
  listMentorAssignedInstitutionPrograms,
  listMentorAssignedProjects,
} from './mentorshipProgram.service';
import {
  CreateMentorFeedbackInput,
  CreateMentorSessionInput,
  MentorDashboardData,
  MentorFeedbackItem,
  MentorFeedStudent,
  MentorSessionItem,
  MentorSessionsResponse,
  MentorStudentProfile,
  MentorWorkspaceDetail,
  UpdateMentorSessionInput,
} from './mentor.types';

type MentorFeedEvent = {
  studentId: string;
  trigger: string;
  newScore: number;
  delta: number;
  timestamp: string;
};

const activityLabel: Record<string, string> = {
  PROBLEM_CLAIMED: 'claimed a new problem',
  SKILL_COMPLETED: 'completed a skill milestone',
  PROGRESS_UPLOADED: 'uploaded workspace progress',
  PATENT_SUBMITTED: 'submitted a patent',
  PATENT_APPROVED: 'had a patent approved',
  MVP_VERIFIED: 'verified an MVP',
  MARKET_READY_VERIFIED: 'marked a product market ready',
  STARTUP_LAUNCHED: 'launched a startup',
  AWARD_APPROVED: 'had an award approved',
};

const toIso = (value: Date | string) => new Date(value).toISOString();

const canEditMentorNotes = (session: { status: 'Scheduled' | 'Completed' | 'Cancelled'; scheduledAt: Date }) =>
  session.status === 'Completed' && Date.now() <= new Date(session.scheduledAt).getTime() + 24 * 60 * 60 * 1000;

const mapSession = (
  session: {
    _id: Types.ObjectId;
    mentorId: Types.ObjectId;
    studentId: Types.ObjectId;
    workspaceId?: Types.ObjectId;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
    meetLink?: string;
    status: 'Scheduled' | 'Completed' | 'Cancelled';
    mentorNotes?: string;
    studentFeedback?: string;
    createdAt: Date;
  },
  mentor: { _id: Types.ObjectId; displayName: string; avatar?: string },
  student: { _id: Types.ObjectId; displayName: string; avatar?: string },
): MentorSessionItem => ({
  _id: String(session._id),
  mentor: {
    _id: String(mentor._id),
    displayName: mentor.displayName,
    ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
  },
  student: {
    _id: String(student._id),
    displayName: student.displayName,
    ...(student.avatar ? { avatar: student.avatar } : {}),
  },
  ...(session.workspaceId ? { workspaceId: String(session.workspaceId) } : {}),
  title: session.title,
  scheduledAt: toIso(session.scheduledAt),
  durationMinutes: session.durationMinutes,
  ...(session.meetLink ? { meetLink: session.meetLink } : {}),
  status: session.status,
  ...(session.mentorNotes ? { mentorNotes: session.mentorNotes } : {}),
  ...(session.studentFeedback ? { studentFeedback: session.studentFeedback } : {}),
  createdAt: toIso(session.createdAt),
});

const readMentorFeed = async (mentorId: string) => {
  const raw = (await redis.lrange(`mentor:feed:${mentorId}`, 0, 9)) as string[];
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry) as MentorFeedEvent;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is MentorFeedEvent => entry !== null)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
};

const getStudentSummary = async (studentId: string) => {
  const [student, recentEvent] = await Promise.all([
    User.findById(studentId).select('_id displayName avatar innovationScore createdAt').lean(),
    ScoreEvent.findOne({ userId: studentId }).sort({ createdAt: -1 }).lean(),
  ]);

  return {
    student,
    summary: recentEvent
      ? `${recentEvent.trigger.replace(/_/g, ' ').toLowerCase()} for +${recentEvent.delta} pts`
      : 'Recent activity available',
  };
};

type MentorWorkspaceAccess = {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamMemberIds?: Types.ObjectId[];
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: Date;
};

const getWorkspaceTeamMemberIds = (workspace: Pick<MentorWorkspaceAccess, 'teamMemberIds'>) =>
  Array.isArray(workspace.teamMemberIds) ? workspace.teamMemberIds : [];

const getMentorAssignedWorkspaces = async (mentorId: string): Promise<MentorWorkspaceAccess[]> =>
  Workspace.find({
    isActive: true,
    chatParticipants: {
      $elemMatch: {
        userId: new Types.ObjectId(mentorId),
        role: 'mentor',
      },
    },
  })
    .select('_id ownerId teamMemberIds title category stage progressPercent updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

const getMentorAssignedStudentIds = (workspaces: MentorWorkspaceAccess[]) =>
  Array.from(
    new Set(
      workspaces.flatMap((workspace) => [
        String(workspace.ownerId),
        ...getWorkspaceTeamMemberIds(workspace).map((memberId) => String(memberId)),
      ]),
    ),
  );

const assertMentorStudentAccess = async (mentorId: string, studentId: string) => {
  const hasAssignment = await Workspace.exists({
    isActive: true,
    chatParticipants: {
      $elemMatch: {
        userId: new Types.ObjectId(mentorId),
        role: 'mentor',
      },
    },
    $or: [{ ownerId: new Types.ObjectId(studentId) }, { teamMemberIds: new Types.ObjectId(studentId) }],
  });

  if (!hasAssignment) {
    throw new ApiError(403, 'MENTOR_ASSIGNMENT_REQUIRED', 'This student is not assigned to you');
  }
};

const assertMentorWorkspaceAccess = async (mentorId: string, studentId: string, workspaceId: string) => {
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isActive: true,
    chatParticipants: {
      $elemMatch: {
        userId: new Types.ObjectId(mentorId),
        role: 'mentor',
      },
    },
  }).lean();

  if (!workspace) {
    throw new ApiError(403, 'MENTOR_ASSIGNMENT_REQUIRED', 'This workspace is not assigned to you');
  }

  const isOwner = String(workspace.ownerId) === studentId;
  const isMember = getWorkspaceTeamMemberIds(workspace).some((memberId) => String(memberId) === studentId);
  if (!isOwner && !isMember) {
    throw new ApiError(403, 'FORBIDDEN', 'Workspace is not available to this student');
  }

  return workspace;
};

export const getMentorDashboard = async (mentorId: string): Promise<MentorDashboardData> => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [sessionsToday, pendingReviews, assignedProjects, institutionPrograms, activities] = await Promise.all([
    MentorSession.countDocuments({ mentorId, scheduledAt: { $gte: startOfDay, $lte: now } }),
    MentorSession.countDocuments({ mentorId, status: 'Completed', mentorNotes: { $in: [null, ''] } }),
    listMentorAssignedProjects(mentorId),
    listMentorAssignedInstitutionPrograms(mentorId),
    readMentorFeed(mentorId),
  ]);

  const assignedStudentIds = Array.from(
    new Set(assignedProjects.flatMap((project) => project.students.map((student) => student._id))),
  );
  const studentIds = assignedStudentIds.length > 0 ? assignedStudentIds : activities.map((item) => item.studentId);
  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } }).select('_id displayName avatar').lean()
      : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return {
    sessionsToday,
    pendingReviews,
    activeStudentCount: assignedStudentIds.length,
    assignedProjectsCount: assignedProjects.length,
    assignedProgramsCount: institutionPrograms.length,
    recentActivities: activities
      .filter((activity) => assignedStudentIds.includes(activity.studentId))
      .map((activity) => {
      const student = studentMap.get(activity.studentId);
      return {
        studentId: activity.studentId,
        studentName: student?.displayName ?? 'Student',
        ...(student?.avatar ? { avatar: student.avatar } : {}),
        trigger: activityLabel[activity.trigger] ?? activity.trigger.replace(/_/g, ' ').toLowerCase(),
        newScore: activity.newScore,
        delta: activity.delta,
        timestamp: activity.timestamp,
      };
    }),
    projectAssignments: assignedProjects,
    institutionPrograms,
  };
};

export const getMentorStudents = async (mentorId: string): Promise<MentorFeedStudent[]> => {
  const watched = new Set((await redis.smembers(`mentor:watch:${mentorId}`)) as string[]);
  const workspaces = await getMentorAssignedWorkspaces(mentorId);
  const workspaceIds = workspaces.map((workspace) => String(workspace._id));
  const startups =
    workspaceIds.length > 0
      ? await Startup.find({ projectId: { $in: workspaceIds }, isActive: true })
          .sort({ innovationScoreAtLaunch: -1, createdAt: -1 })
          .lean()
      : [];
  const startupMap = new Map(
    startups
      .filter((startup) => startup.projectId)
      .map((startup) => [String(startup.projectId), startup]),
  );

  return Promise.all(workspaces.map(async (workspace) => {
    const leadStudentId = String(workspace.ownerId);
    const { student: leadStudent, summary } = await getStudentSummary(leadStudentId);
    const startup = startupMap.get(String(workspace._id));

    return {
      _id: String(workspace._id),
      workspaceId: String(workspace._id),
      studentId: leadStudentId,
      displayName: leadStudent?.displayName ?? 'Student',
      ...(leadStudent?.avatar ? { avatar: leadStudent.avatar } : {}),
      startupName: startup?.name ?? workspace.title,
      category: startup?.category ?? workspace.category,
      innovationScore: leadStudent?.innovationScore ?? 0,
      recentActivitySummary: summary,
      isWatched: watched.has(leadStudentId),
      activeSince: leadStudent?.createdAt ? toIso(leadStudent.createdAt) : toIso(workspace.updatedAt),
    };
  }));
};

export const getMentorStudentProfile = async (mentorId: string, studentId: string): Promise<MentorStudentProfile> => {
  await assertMentorStudentAccess(mentorId, studentId);

  const student = await User.findById(studentId).lean();
  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  await ProfileView.create({
    viewerId: mentorId,
    viewedId: studentId,
    viewerRole: UserRole.MENTOR,
    viewedAt: new Date(),
  });
  await queueMentorViewedProfileEmail(studentId, mentorId);

  // Scope to workspaces where this mentor is assigned as a chat participant
  const assignedWorkspaces = await Workspace.find({
    isActive: true,
    chatParticipants: { $elemMatch: { userId: new Types.ObjectId(mentorId), role: 'mentor' } },
    $or: [{ ownerId: new Types.ObjectId(studentId) }, { teamMemberIds: new Types.ObjectId(studentId) }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const assignedWorkspaceIds = assignedWorkspaces.map((w) => w._id);

  const [scoreEvents, patents, startups] = await Promise.all([
    ScoreEvent.find({ userId: studentId }).sort({ createdAt: -1 }).limit(20).lean(),
    // Only patents linked to assigned workspaces, or where student is inventor
    assignedWorkspaceIds.length > 0
      ? Patent.find({
          $or: [
            { studentId, workspaceId: { $in: assignedWorkspaceIds } },
            { coInventorIds: studentId, workspaceId: { $in: assignedWorkspaceIds } },
          ],
        }).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]),
    // Only startups linked to assigned workspaces
    assignedWorkspaceIds.length > 0
      ? Startup.find({
          isActive: true,
          projectId: { $in: assignedWorkspaceIds },
        }).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]),
  ]);

  return {
    student: {
      _id: String(student._id),
      displayName: student.displayName,
      ...(student.avatar ? { avatar: student.avatar } : {}),
      ...(student.bio ? { bio: student.bio } : {}),
      ...(student.domain ? { domain: student.domain } : {}),
      innovationScore: student.innovationScore ?? 0,
      scoreBreakdown: student.scoreBreakdown,
      ...(student.institutionProfile?.institutionName
        ? { institutionName: student.institutionProfile.institutionName }
        : {}),
    },
    workspaces: assignedWorkspaces.map((workspace) => ({
      _id: String(workspace._id),
      title: workspace.title,
      category: workspace.category,
      stage: workspace.stage,
      progressPercent: workspace.progressPercent,
      updatedAt: toIso(workspace.updatedAt),
    })),
    scoreEvents: scoreEvents.map((event) => ({
      _id: String(event._id),
      trigger: event.trigger,
      delta: event.delta,
      scoreAfter: event.scoreAfter,
      createdAt: toIso(event.createdAt),
    })),
    patents: patents.map((patent) => ({
      _id: String(patent._id),
      projectTitle: patent.projectTitle,
      status: patent.status,
      submittedAt: toIso(patent.submittedAt),
    })),
    startups: startups.map((startup) => ({
      _id: String(startup._id),
      name: startup.name,
      category: startup.category,
      stage: startup.stage,
      ...(startup.launchedAt ? { launchedAt: toIso(startup.launchedAt) } : {}),
      innovationScoreAtLaunch: startup.innovationScoreAtLaunch ?? 0,
    })),
  };
};

export const getMentorWorkspace = async (
  mentorId: string,
  studentId: string,
  workspaceId: string,
): Promise<MentorWorkspaceDetail> => {
  const workspace = await assertMentorWorkspaceAccess(mentorId, studentId, workspaceId);

  return {
    _id: String(workspace._id),
    title: workspace.title,
    category: workspace.category,
    stage: workspace.stage,
    progressPercent: workspace.progressPercent,
    milestones: workspace.milestones.map((milestone) => ({
      _id: milestone._id,
      name: milestone.name,
      isCompleted: milestone.isCompleted,
      completionPercent: milestone.completionPercent,
      ...(milestone.completedAt ? { completedAt: milestone.completedAt } : {}),
      ...(milestone.completedBy ? { completedBy: milestone.completedBy } : {}),
    })),
    tasks: workspace.tasks.map((task) => ({
      _id: task._id,
      title: task.title,
      priority: task.priority,
      done: task.done,
      ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    })),
    uploads: workspace.uploads.map((upload) => ({
      _id: upload._id,
      fileUrl: upload.fileUrl,
      fileType: upload.fileType,
      fileName: upload.fileName,
      uploadedAt: upload.uploadedAt,
    })),
    progressUpdates: workspace.progressUpdates.map((update) => ({
      _id: update._id,
      note: update.note,
      submittedAt: update.submittedAt,
    })),
  };
};

export const createMentorSession = async (mentorId: string, payload: CreateMentorSessionInput) => {
  await assertMentorStudentAccess(mentorId, payload.studentId);
  const scheduledAt = new Date(payload.scheduledAt);

  const [student, mentor, workspace] = await Promise.all([
    User.findById(payload.studentId).select('_id displayName avatar role').lean(),
    User.findById(mentorId).select('_id displayName role').lean(),
    payload.workspaceId ? assertMentorWorkspaceAccess(mentorId, payload.studentId, payload.workspaceId) : Promise.resolve(null),
  ]);

  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (!mentor || mentor.role !== UserRole.MENTOR) {
    throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Mentor not found');
  }

  await assertMentorAvailability({
    mentorId,
    scheduledAt,
    durationMinutes: payload.durationMinutes,
  });

  const session = await MentorSession.create({
    mentorId,
    studentId: payload.studentId,
    ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
    title: payload.title,
    scheduledAt,
    durationMinutes: payload.durationMinutes,
    ...(payload.meetLink ? { meetLink: payload.meetLink } : {}),
    status: 'Scheduled',
  });

  const notification = await NotificationService.create({
    userId: payload.studentId,
    type: 'system',
    title: `${mentor.displayName} scheduled a session with you`,
    body: `${mentor.displayName} scheduled a mentor session titled "${payload.title}".`,
    link: '/dashboard/student',
  });

  if (io) {
    io.of('/notifications').to(`user:${payload.studentId}`).emit('notification:new', notification);
  }

  return session;
};

const toSessionViews = async (sessions: Array<{
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: Date;
}>) => {
  const participantIds = [...new Set(sessions.flatMap((session) => [String(session.mentorId), String(session.studentId)]))];
  const workspaceIds = sessions.map((s) => s.workspaceId).filter((id): id is Types.ObjectId => !!id);
  const [users, workspaces] = await Promise.all([
    participantIds.length > 0 ? User.find({ _id: { $in: participantIds } }).select('_id displayName avatar').lean() : Promise.resolve([]),
    workspaceIds.length > 0 ? Workspace.find({ _id: { $in: workspaceIds } }).select('_id title').lean() : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const wsMap = new Map(workspaces.map((ws) => [String(ws._id), ws.title]));

  return sessions.map((session) => ({
    ...mapSession(
      session,
      userMap.get(String(session.mentorId)) ?? { _id: session.mentorId, displayName: 'Mentor' },
      userMap.get(String(session.studentId)) ?? { _id: session.studentId, displayName: 'Student' },
    ),
    ...(session.workspaceId ? { workspaceName: wsMap.get(String(session.workspaceId)) ?? undefined } : {}),
  }));
};

export const listMentorSessions = async (mentorId: string): Promise<MentorSessionsResponse> => {
  const sessions = await MentorSession.find({ mentorId }).sort({ scheduledAt: -1 }).lean();
  const mapped = await toSessionViews(sessions);

  return {
    upcoming: mapped
      .filter((session) => session.status === 'Scheduled')
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt)),
    completed: mapped
      .filter((session) => session.status === 'Completed')
      .sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt)),
    cancelled: mapped
      .filter((session) => session.status === 'Cancelled')
      .sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt)),
  };
};

export const getMentorSession = async (mentorId: string, sessionId: string) => {
  const session = await MentorSession.findById(sessionId).lean();
  if (!session || String(session.mentorId) !== mentorId) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const views = await toSessionViews([session]);
  const [mentorProfile, studentProfile] = await Promise.all([
    User.findById(session.mentorId).select('_id displayName avatar').lean(),
    User.findById(session.studentId).select('_id displayName avatar innovationScore scoreBreakdown').lean(),
  ]);

  return {
    ...views[0],
    studentProfile: studentProfile
      ? {
          innovationScore: studentProfile.innovationScore ?? 0,
          scoreBreakdown: studentProfile.scoreBreakdown,
        }
      : undefined,
    mentorProfile,
  };
};

export const updateMentorSession = async (
  mentorId: string,
  sessionId: string,
  payload: UpdateMentorSessionInput,
) => {
  const session = await MentorSession.findById(sessionId);
  if (!session || String(session.mentorId) !== mentorId) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  if (payload.status !== undefined) {
    session.status = payload.status;
  }
  if (payload.mentorNotes !== undefined) {
    if (!canEditMentorNotes(session)) {
      throw new ApiError(
        400,
        'MENTOR_NOTES_LOCKED',
        'Mentor notes can only be edited for completed sessions within 24 hours of the session time',
      );
    }
    session.mentorNotes = payload.mentorNotes;
  }
  if (payload.meetLink !== undefined) {
    session.meetLink = payload.meetLink || undefined;
  }

  await session.save();

  if (session.status === 'Completed') {
    const notification = await NotificationService.create({
      userId: String(session.studentId),
      type: 'system',
      title: 'Mentor notes added to your session',
      body: session.mentorNotes ?? 'Your mentor marked the session as completed.',
      link: '/dashboard/student',
    });
    if (io) {
      io.of('/notifications').to(`user:${String(session.studentId)}`).emit('notification:new', notification);
    }
  }

  const [mentorProfile, studentProfile] = await Promise.all([
    User.findById(session.mentorId).select('_id displayName avatar').lean(),
    User.findById(session.studentId).select('_id displayName avatar innovationScore scoreBreakdown').lean(),
  ]);

  const views = await toSessionViews([session.toObject()]);
  return {
    ...views[0],
    studentProfile: studentProfile
      ? {
          innovationScore: studentProfile.innovationScore ?? 0,
          scoreBreakdown: studentProfile.scoreBreakdown,
        }
      : undefined,
    mentorProfile,
  };
};

export const deleteMentorSession = async (mentorId: string, sessionId: string) => {
  const session = await MentorSession.findById(sessionId);
  if (!session || String(session.mentorId) !== mentorId) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
  if (session.status !== 'Scheduled') {
    throw new ApiError(400, 'SESSION_NOT_CANCELLABLE', 'Only scheduled sessions can be cancelled');
  }

  session.status = 'Cancelled';
  await session.save();

  const notification = await NotificationService.create({
    userId: String(session.studentId),
    type: 'system',
    title: 'Mentor session cancelled',
    body: `${session.title} was cancelled by your mentor.`,
    link: '/dashboard/student',
  });
  if (io) {
    io.of('/notifications').to(`user:${String(session.studentId)}`).emit('notification:new', notification);
  }
};

export const createMentorFeedback = async (
  mentorId: string,
  payload: CreateMentorFeedbackInput,
): Promise<MentorFeedbackItem> => {
  await assertMentorStudentAccess(mentorId, payload.studentId);

  const [student, workspace] = await Promise.all([
    User.findOne({ _id: payload.studentId, role: UserRole.STUDENT }).select('_id displayName').lean(),
    payload.workspaceId ? assertMentorWorkspaceAccess(mentorId, payload.studentId, payload.workspaceId) : Promise.resolve(null),
  ]);

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }
  const feedback = await MentorFeedback.create({
    mentorId,
    studentId: payload.studentId,
    ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
    feedbackText: payload.feedbackText,
    rating: payload.rating,
  });

  const notification = await NotificationService.create({
    userId: payload.studentId,
    type: 'system',
    title: 'New mentor feedback received',
    body: `Your mentor shared feedback and rated your progress ${payload.rating}/5.`,
    link: '/dashboard/student',
  });

  if (io) {
    io.of('/notifications').to(`user:${payload.studentId}`).emit('notification:new', notification);
  }

  return {
    _id: String(feedback._id),
    mentorId,
    studentId: payload.studentId,
    ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
    feedbackText: feedback.feedbackText,
    rating: feedback.rating as 1 | 2 | 3 | 4 | 5,
    createdAt: toIso(feedback.createdAt),
  };
};

// ---------------------------------------------------------------------------
// Mentor Bidding / Marketplace
// ---------------------------------------------------------------------------

export const getBidOpportunities = async (mentorId: string) => {
  const [startups, problems, existingBids] = await Promise.all([
    Startup.find({ launchedToMentors: true, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    Problem.find({ publicationStatus: 'published', claimStatus: 'open' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    MentorBid.find({ mentorId, status: { $ne: 'withdrawn' } })
      .select('opportunityId')
      .lean(),
  ]);

  const bidSet = new Set(existingBids.map((bid) => String(bid.opportunityId)));

  const startupOpportunities = startups.map((startup) => ({
    _id: String(startup._id),
    kind: 'startup' as const,
    title: startup.name || 'Untitled Startup',
    description: startup.businessProfile?.problemStatement || startup.tagline || 'No description available',
    domain: startup.category || 'General',
    stage: startup.stage,
    startupName: startup.name,
    preferredExpertise: [] as string[],
    postedAt: toIso(startup.updatedAt),
    hasBid: bidSet.has(String(startup._id)),
  }));

  const problemOpportunities = problems.map((problem) => ({
    _id: String(problem._id),
    kind: 'problem_bank' as const,
    title: problem.title,
    description: problem.description.slice(0, 300),
    domain: problem.domain || problem.category,
    stage: problem.difficulty,
    institution: problem.postedBy,
    preferredExpertise: problem.tags ?? [],
    sessionsRequested: undefined as number | undefined,
    postedAt: toIso(problem.createdAt),
    hasBid: bidSet.has(String(problem._id)),
  }));

  return [...startupOpportunities, ...problemOpportunities].sort(
    (a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt),
  );
};

export const getMentorBids = async (mentorId: string) => {
  const bids = await MentorBid.find({ mentorId }).sort({ createdAt: -1 }).lean();
  return bids.map((bid) => ({
    _id: String(bid._id),
    opportunityId: String(bid.opportunityId),
    opportunityTitle: bid.opportunityTitle,
    kind: bid.kind,
    expertise: bid.expertise,
    hoursPerWeek: bid.hoursPerWeek,
    proposedDurationWeeks: bid.proposedDurationWeeks,
    coverNote: bid.coverNote,
    status: bid.status,
    createdAt: toIso(bid.createdAt),
  }));
};

export const submitMentorBid = async (
  mentorId: string,
  payload: {
    opportunityId: string;
    kind: 'startup' | 'problem_bank';
    expertise: string;
    hoursPerWeek: number;
    proposedDurationWeeks: number;
    coverNote: string;
  },
) => {
  // Verify opportunity exists
  let opportunityTitle = 'Unknown';
  if (payload.kind === 'startup') {
    const startup = await Startup.findById(payload.opportunityId).select('name').lean();
    if (!startup) throw new ApiError(404, 'NOT_FOUND', 'Startup not found');
    opportunityTitle = startup.name || 'Untitled Startup';
  } else {
    const problem = await Problem.findById(payload.opportunityId).select('title').lean();
    if (!problem) throw new ApiError(404, 'NOT_FOUND', 'Problem not found');
    opportunityTitle = problem.title;
  }

  // Check for duplicate active bid
  const existingBid = await MentorBid.findOne({
    mentorId,
    opportunityId: payload.opportunityId,
    status: { $ne: 'withdrawn' },
  }).lean();

  if (existingBid) {
    throw new ApiError(409, 'DUPLICATE_BID', 'You have already submitted a bid for this opportunity');
  }

  const bid = await MentorBid.create({
    mentorId,
    opportunityId: payload.opportunityId,
    opportunityTitle,
    kind: payload.kind,
    expertise: payload.expertise,
    hoursPerWeek: payload.hoursPerWeek,
    proposedDurationWeeks: payload.proposedDurationWeeks,
    coverNote: payload.coverNote,
    status: 'pending',
  });

  return {
    _id: String(bid._id),
    opportunityId: String(bid.opportunityId),
    opportunityTitle: bid.opportunityTitle,
    kind: bid.kind,
    expertise: bid.expertise,
    hoursPerWeek: bid.hoursPerWeek,
    proposedDurationWeeks: bid.proposedDurationWeeks,
    coverNote: bid.coverNote,
    status: bid.status,
    createdAt: toIso(bid.createdAt),
  };
};

export const withdrawMentorBid = async (mentorId: string, bidId: string) => {
  const bid = await MentorBid.findById(bidId);
  if (!bid || String(bid.mentorId) !== mentorId) {
    throw new ApiError(404, 'BID_NOT_FOUND', 'Bid not found');
  }
  if (bid.status !== 'pending') {
    throw new ApiError(400, 'BID_NOT_WITHDRAWABLE', 'Only pending bids can be withdrawn');
  }
  bid.status = 'withdrawn';
  await bid.save();
  return { updated: true };
};
