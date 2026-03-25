import { Types } from 'mongoose';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { NotificationService } from '../notification/notification.service';
import { Patent } from '../patent/patent.model';
import { ScoreEvent } from '../innovationScore/score.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { MentorSession } from './mentorSession.model';
import { MentorFeedback } from './mentorFeedback.model';
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

export const getMentorDashboard = async (mentorId: string): Promise<MentorDashboardData> => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [sessionsToday, pendingReviews, activeStudentCount, activities, watchedStudents] = await Promise.all([
    MentorSession.countDocuments({ mentorId, scheduledAt: { $gte: startOfDay, $lte: now } }),
    MentorSession.countDocuments({ mentorId, status: 'Completed', mentorNotes: { $in: [null, ''] } }),
    redis.scard(`mentor:watch:${mentorId}`),
    readMentorFeed(mentorId),
    redis.smembers(`mentor:watch:${mentorId}`) as Promise<string[]>,
  ]);

  const studentIds = watchedStudents.length > 0 ? watchedStudents : activities.map((item) => item.studentId);
  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } }).select('_id displayName avatar').lean()
      : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return {
    sessionsToday,
    pendingReviews,
    activeStudentCount,
    recentActivities: activities.map((activity) => {
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
  };
};

export const getMentorStudents = async (mentorId: string): Promise<MentorFeedStudent[]> => {
  const watched = new Set((await redis.smembers(`mentor:watch:${mentorId}`)) as string[]);
  const startups = await Startup.find({ launchedToMentors: true, isActive: true })
    .sort({ innovationScoreAtLaunch: -1, createdAt: -1 })
    .lean();

  return Promise.all(startups.map(async (startup) => {
    const founderId = String(startup.founderIds[0] ?? '');
    const { student: founder, summary } = founderId ? await getStudentSummary(founderId) : { student: null, summary: 'Recent activity available' };
    return {
      _id: String(startup._id),
      studentId: founderId,
      displayName: founder?.displayName ?? 'Student',
      ...(founder?.avatar ? { avatar: founder.avatar } : {}),
      startupName: startup.name,
      category: startup.category,
      innovationScore: startup.innovationScoreAtLaunch ?? founder?.innovationScore ?? 0,
      recentActivitySummary: summary,
      isWatched: founderId ? watched.has(founderId) : false,
      activeSince: founder?.createdAt ? toIso(founder.createdAt) : toIso(startup.createdAt),
    };
  }));
};

export const getMentorStudentProfile = async (studentId: string): Promise<MentorStudentProfile> => {
  const student = await User.findById(studentId).lean();
  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const [workspaces, scoreEvents, patents, startups] = await Promise.all([
    Workspace.find({ $or: [{ ownerId: studentId }, { teamMemberIds: studentId }] })
      .sort({ updatedAt: -1 })
      .lean(),
    ScoreEvent.find({ userId: studentId }).sort({ createdAt: -1 }).limit(20).lean(),
    Patent.find({ studentId }).sort({ createdAt: -1 }).lean(),
    Startup.find({ founderIds: studentId }).sort({ createdAt: -1 }).lean(),
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
    workspaces: workspaces.map((workspace) => ({
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

export const getMentorWorkspace = async (studentId: string, workspaceId: string): Promise<MentorWorkspaceDetail> => {
  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isOwner = String(workspace.ownerId) === studentId;
  const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === studentId);
  if (!isOwner && !isMember) {
    throw new ApiError(403, 'FORBIDDEN', 'Workspace is not available to this student');
  }

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
  const [student, mentor, workspace] = await Promise.all([
    User.findById(payload.studentId).select('_id displayName avatar role').lean(),
    User.findById(mentorId).select('_id displayName role').lean(),
    payload.workspaceId
      ? Workspace.findById(payload.workspaceId).select('_id ownerId teamMemberIds').lean()
      : Promise.resolve(null),
  ]);

  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (!mentor || mentor.role !== UserRole.MENTOR) {
    throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Mentor not found');
  }

  if (workspace) {
    const isOwner = String(workspace.ownerId) === payload.studentId;
    const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === payload.studentId);
    if (!isOwner && !isMember) {
      throw new ApiError(403, 'FORBIDDEN', 'Workspace is not available to this student');
    }
  }

  const session = await MentorSession.create({
    mentorId,
    studentId: payload.studentId,
    ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
    title: payload.title,
    scheduledAt: new Date(payload.scheduledAt),
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
  const users = participantIds.length > 0 ? await User.find({ _id: { $in: participantIds } }).select('_id displayName avatar').lean() : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return sessions.map((session) =>
    mapSession(
      session,
      userMap.get(String(session.mentorId)) ?? { _id: session.mentorId, displayName: 'Mentor' },
      userMap.get(String(session.studentId)) ?? { _id: session.studentId, displayName: 'Student' },
    ),
  );
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
  const [student, workspace] = await Promise.all([
    User.findOne({ _id: payload.studentId, role: UserRole.STUDENT }).select('_id displayName').lean(),
    payload.workspaceId
      ? Workspace.findById(payload.workspaceId).select('_id ownerId teamMemberIds').lean()
      : Promise.resolve(null),
  ]);

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (workspace) {
    const isOwner = String(workspace.ownerId) === payload.studentId;
    const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === payload.studentId);
    if (!isOwner && !isMember) {
      throw new ApiError(403, 'FORBIDDEN', 'Workspace is not available to this student');
    }
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
