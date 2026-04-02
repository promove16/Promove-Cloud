import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { NotificationService } from '../notification/notification.service';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import {
  AdminCreateInstitutionMentorshipProgramInput,
  AdminProjectMentorshipItem,
  AdminProjectMentorshipView,
  CreateInstitutionMentorshipProgramInput,
  CreateMentorProfileInput,
  CreatedMentorProfileResult,
  InstitutionMentorshipProgramItem,
  InstitutionMentorshipProgramListResponse,
  InstitutionMentorshipProgramReviewInput,
  InstitutionMentorshipProgramStats,
  InstitutionMentorshipProgramView,
  MentorAssignedInstitutionProgram,
  MentorAssignedProject,
  MentorshipAdminMentorItem,
  ProjectMentorAssignmentInput,
} from './mentor.types';
import { InstitutionMentorshipProgram } from './mentorshipProgram.model';

const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

const toIso = (value: Date | string) => new Date(value).toISOString();

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

const invalidateInstitutionMentorshipCaches = async (institutionId: string) => {
  await redis.del(
    `school:stats:${institutionId}`,
    `school:dashboard:${institutionId}`,
    `college:dashboard:${institutionId}`,
  );
};

const mapProgram = (
  program: {
    _id: Types.ObjectId;
    institutionId: Types.ObjectId;
    institutionType: 'school' | 'college';
    requestedBy: Types.ObjectId;
    mentorId?: Types.ObjectId;
    title: string;
    objective: string;
    preferredDate: Date;
    scheduledAt?: Date;
    durationMinutes: number;
    expectedParticipants: number;
    deliveryMode: 'Online' | 'Offline';
    platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
    meetingLink?: string;
    venue?: string;
    preferredExpertise?: string;
    adminNotes?: string;
    rejectionReason?: string;
    status: 'Pending' | 'Assigned' | 'Rejected';
    createdAt: Date;
    updatedAt: Date;
  },
  institution: { _id: Types.ObjectId; displayName: string; institutionProfile?: { institutionName: string } },
  requester: { _id: Types.ObjectId; displayName: string; email: string },
  mentor?: { _id: Types.ObjectId; displayName: string; email: string; avatar?: string; domain?: string; bio?: string },
): InstitutionMentorshipProgramItem => ({
  _id: String(program._id),
  institution: {
    _id: String(institution._id),
    displayName: institution.institutionProfile?.institutionName ?? institution.displayName,
    type: program.institutionType,
  },
  requestedBy: {
    _id: String(requester._id),
    displayName: requester.displayName,
    email: requester.email,
  },
  ...(mentor
    ? {
        mentor: {
          _id: String(mentor._id),
          displayName: mentor.displayName,
          email: mentor.email,
          ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
          ...(mentor.domain ? { domain: mentor.domain } : {}),
          ...(mentor.bio ? { bio: mentor.bio } : {}),
        },
      }
    : {}),
  title: program.title,
  objective: program.objective,
  preferredDate: toIso(program.preferredDate),
  ...(program.scheduledAt ? { scheduledAt: toIso(program.scheduledAt) } : {}),
  durationMinutes: program.durationMinutes,
  expectedParticipants: program.expectedParticipants,
  deliveryMode: program.deliveryMode,
  platform: program.platform,
  ...(program.meetingLink ? { meetingLink: program.meetingLink } : {}),
  ...(program.venue ? { venue: program.venue } : {}),
  ...(program.preferredExpertise ? { preferredExpertise: program.preferredExpertise } : {}),
  ...(program.adminNotes ? { adminNotes: program.adminNotes } : {}),
  ...(program.rejectionReason ? { rejectionReason: program.rejectionReason } : {}),
  status: program.status,
  createdAt: toIso(program.createdAt),
  updatedAt: toIso(program.updatedAt),
});

const toProgramViews = async (
  programs: Array<{
    _id: Types.ObjectId;
    institutionId: Types.ObjectId;
    institutionType: 'school' | 'college';
    requestedBy: Types.ObjectId;
    mentorId?: Types.ObjectId;
    title: string;
    objective: string;
    preferredDate: Date;
    scheduledAt?: Date;
    durationMinutes: number;
    expectedParticipants: number;
    deliveryMode: 'Online' | 'Offline';
    platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
    meetingLink?: string;
    venue?: string;
    preferredExpertise?: string;
    adminNotes?: string;
    rejectionReason?: string;
    status: 'Pending' | 'Assigned' | 'Rejected';
    createdAt: Date;
    updatedAt: Date;
  }>,
): Promise<InstitutionMentorshipProgramItem[]> => {
  const userIds = [
    ...new Set(
      programs.flatMap((program) => [
        String(program.institutionId),
        String(program.requestedBy),
        ...(program.mentorId ? [String(program.mentorId)] : []),
      ]),
    ),
  ];

  const users =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds } })
          .select('_id displayName email avatar domain bio institutionProfile')
          .lean()
      : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return programs.map((program) =>
    mapProgram(
      program,
      userMap.get(String(program.institutionId)) ?? {
        _id: program.institutionId,
        displayName: 'Institution',
      },
      userMap.get(String(program.requestedBy)) ?? {
        _id: program.requestedBy,
        displayName: 'Requester',
        email: '',
      },
      program.mentorId ? userMap.get(String(program.mentorId)) : undefined,
    ),
  );
};

const buildStats = (programs: InstitutionMentorshipProgramItem[]): InstitutionMentorshipProgramStats => ({
  total: programs.length,
  pending: programs.filter((program) => program.status === 'Pending').length,
  assigned: programs.filter((program) => program.status === 'Assigned').length,
  rejected: programs.filter((program) => program.status === 'Rejected').length,
});

type WorkspaceMentorSnapshot = {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  chatParticipants: Array<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    role: 'mentor' | 'investor';
    addedBy: Types.ObjectId;
    addedAt: Date;
  }>;
  updatedAt: Date;
};

type AssignmentUser = {
  _id: Types.ObjectId;
  displayName: string;
  email?: string;
  avatar?: string;
  domain?: string;
  bio?: string;
  headline?: string;
  institutionProfile?: {
    institutionName?: string;
  };
};

const getWorkspaceStudentIds = (workspace: Pick<WorkspaceMentorSnapshot, 'ownerId' | 'teamMemberIds'>) =>
  Array.from(new Set([String(workspace.ownerId), ...workspace.teamMemberIds.map((memberId) => String(memberId))]));

const getWorkspaceMentorParticipant = (workspace: Pick<WorkspaceMentorSnapshot, 'chatParticipants'>) =>
  workspace.chatParticipants.find((participant) => participant.role === 'mentor');

const loadAssignmentUsers = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, AssignmentUser>();
  }

  const users = await User.find({ _id: { $in: userIds } })
    .select('_id displayName email avatar domain bio headline institutionProfile')
    .lean();

  return new Map(users.map((user) => [String(user._id), user]));
};

const mapAssignmentStudents = (
  workspace: Pick<WorkspaceMentorSnapshot, 'ownerId' | 'teamMemberIds'>,
  userMap: Map<string, AssignmentUser>,
) =>
  getWorkspaceStudentIds(workspace).map((studentId) => {
    const student = userMap.get(studentId);

    return {
      _id: studentId,
      displayName: student?.displayName ?? 'Student',
      ...(student?.avatar ? { avatar: student.avatar } : {}),
      ...(student?.institutionProfile?.institutionName
        ? { institutionName: student.institutionProfile.institutionName }
        : {}),
    };
  });

const mapAssignmentMentor = (
  mentorId: string | undefined,
  userMap: Map<string, AssignmentUser>,
) => {
  if (!mentorId) {
    return undefined;
  }

  const mentor = userMap.get(mentorId);
  if (!mentor) {
    return {
      _id: mentorId,
      displayName: 'Mentor',
      email: '',
    };
  }

  return {
    _id: mentorId,
    displayName: mentor.displayName,
    email: mentor.email ?? '',
    ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
    ...(mentor.domain ? { domain: mentor.domain } : {}),
    ...(mentor.bio ? { bio: mentor.bio } : {}),
  };
};

const addMentorWatchers = async (mentorId: string, studentIds: string[]) => {
  if (studentIds.length === 0) {
    return;
  }

  await Promise.all(
    studentIds.flatMap((studentId) => [
      redis.sadd(`mentor:watch:${mentorId}`, studentId),
      redis.sadd(`student:watchers:${studentId}`, mentorId),
    ]),
  );
};

const removeMentorWatchersForWorkspace = async (
  mentorId: string,
  workspaceId: string,
  studentIds: string[],
) => {
  await Promise.all(
    studentIds.map(async (studentId) => {
      const stillAssigned = await Workspace.exists({
        _id: { $ne: new Types.ObjectId(workspaceId) },
        isActive: true,
        chatParticipants: {
          $elemMatch: {
            userId: new Types.ObjectId(mentorId),
            role: 'mentor',
          },
        },
        $or: [{ ownerId: new Types.ObjectId(studentId) }, { teamMemberIds: new Types.ObjectId(studentId) }],
      });

      if (!stillAssigned) {
        await Promise.all([
          redis.srem(`mentor:watch:${mentorId}`, studentId),
          redis.srem(`student:watchers:${studentId}`, mentorId),
        ]);
      }
    }),
  );
};

const listProjectMentorshipWorkspaces = async () => {
  const launchedStartups = await Startup.find({
    isActive: true,
    projectId: { $ne: null, $exists: true },
    launchedToMentors: true,
  })
    .select('_id name category projectId launchedAt founderIds')
    .lean();

  const launchedWorkspaceIds = launchedStartups
    .map((startup) => startup.projectId)
    .filter((projectId): projectId is Types.ObjectId => Boolean(projectId))
    .map((projectId) => String(projectId));

  const assignedWorkspaces = await Workspace.find({
    isActive: true,
    chatParticipants: {
      $elemMatch: {
        role: 'mentor',
      },
    },
  })
    .select('_id')
    .lean();

  const workspaceIds = Array.from(
    new Set([...launchedWorkspaceIds, ...assignedWorkspaces.map((workspace) => String(workspace._id))]),
  );

  if (workspaceIds.length === 0) {
    return {
      workspaces: [] as WorkspaceMentorSnapshot[],
      startupMap: new Map<string, (typeof launchedStartups)[number]>(),
    };
  }

  const workspaces = await Workspace.find({ _id: { $in: workspaceIds }, isActive: true })
    .select('_id ownerId teamMemberIds title category stage progressPercent chatParticipants updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  return {
    workspaces: workspaces as WorkspaceMentorSnapshot[],
    startupMap: new Map(
      launchedStartups
        .filter((startup) => startup.projectId)
        .map((startup) => [String(startup.projectId), startup]),
    ),
  };
};

const mapAdminProjectMentorshipItem = (
  workspace: WorkspaceMentorSnapshot,
  startupMap: Map<string, { _id: Types.ObjectId; name: string; category: string; launchedAt?: Date | null }>,
  userMap: Map<string, AssignmentUser>,
): AdminProjectMentorshipItem => {
  const mentorParticipant = getWorkspaceMentorParticipant(workspace);
  const mentorId = mentorParticipant ? String(mentorParticipant.userId) : undefined;
  const startup = startupMap.get(String(workspace._id));

  return {
    workspaceId: String(workspace._id),
    title: workspace.title,
    category: workspace.category,
    stage: workspace.stage,
    progressPercent: workspace.progressPercent,
    updatedAt: toIso(workspace.updatedAt),
    ...(startup?.name ? { startupName: startup.name } : {}),
    preferredExpertise: startup?.category ?? workspace.category,
    students: mapAssignmentStudents(workspace, userMap),
    ...(mentorId ? { mentor: mapAssignmentMentor(mentorId, userMap) } : {}),
  };
};

const mapMentorAssignedProject = (
  workspace: WorkspaceMentorSnapshot,
  startupMap: Map<string, { _id: Types.ObjectId; name: string }>,
  userMap: Map<string, AssignmentUser>,
): MentorAssignedProject => ({
  workspaceId: String(workspace._id),
  title: workspace.title,
  category: workspace.category,
  stage: workspace.stage,
  progressPercent: workspace.progressPercent,
  updatedAt: toIso(workspace.updatedAt),
  ...(startupMap.get(String(workspace._id))?.name
    ? { startupName: startupMap.get(String(workspace._id))?.name }
    : {}),
  students: mapAssignmentStudents(workspace, userMap),
});

const assertInstitutionRequester = async (
  institutionId: string,
  institutionType: 'school' | 'college',
  requesterId: string,
) => {
  const institution = await User.findById(institutionId)
    .select('_id displayName role institutionProfile')
    .lean();

  if (!institution) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  const expectedRole = institutionType === 'school' ? UserRole.SCHOOL : UserRole.COLLEGE;
  if (institution.role !== expectedRole) {
    throw new ApiError(403, 'FORBIDDEN', 'This account cannot request this mentorship program');
  }

  const requester = await User.findById(requesterId).select('_id displayName email role').lean();
  if (!requester || requester.role !== expectedRole) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the institution account can submit this request');
  }

  return { institution, requester };
};

const assertInstitutionAccount = async (institutionId: string) => {
  const institution = await User.findById(institutionId)
    .select('_id displayName email role institutionProfile')
    .lean();

  if (!institution) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  if (institution.role !== UserRole.SCHOOL && institution.role !== UserRole.COLLEGE) {
    throw new ApiError(403, 'FORBIDDEN', 'Only school or college accounts can host mentorship programs');
  }

  return {
    institution,
    institutionType: institution.role === UserRole.SCHOOL ? ('school' as const) : ('college' as const),
  };
};

const assertAssignableMentor = async (mentorId: string) => {
  const mentor = await User.findOne({
    _id: mentorId,
    role: UserRole.MENTOR,
    isActive: true,
    adminApprovalStatus: { $in: ['approved', 'not_required'] },
  })
    .select('_id displayName email avatar domain bio')
    .lean();

  if (!mentor) {
    throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Assigned mentor not found');
  }

  return mentor;
};

export const createInstitutionMentorshipProgram = async (
  institutionId: string,
  institutionType: 'school' | 'college',
  requestedBy: string,
  payload: CreateInstitutionMentorshipProgramInput,
): Promise<InstitutionMentorshipProgramItem> => {
  const { institution, requester } = await assertInstitutionRequester(institutionId, institutionType, requestedBy);

  const created = await InstitutionMentorshipProgram.create({
    institutionId,
    institutionType,
    requestedBy,
    title: sanitizePlainText(payload.title),
    objective: sanitizePlainText(payload.objective),
    preferredDate: new Date(payload.preferredDate),
    durationMinutes: payload.durationMinutes,
    expectedParticipants: payload.expectedParticipants,
    deliveryMode: payload.deliveryMode,
    platform: payload.platform,
    ...(payload.meetingLink ? { meetingLink: payload.meetingLink } : {}),
    ...(payload.venue ? { venue: sanitizePlainText(payload.venue) } : {}),
    ...(payload.preferredExpertise ? { preferredExpertise: sanitizePlainText(payload.preferredExpertise) } : {}),
    status: 'Pending',
  });

  await invalidateInstitutionMentorshipCaches(institutionId);

  const admins = await User.find({ role: UserRole.ADMIN, isActive: true }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      NotificationService.create({
        userId: String(admin._id),
        type: 'system',
        title: 'New mentorship program request',
        body: `${institution.institutionProfile?.institutionName ?? institution.displayName} requested a mentorship program.`,
        link: '/dashboard/admin',
      }),
    ),
  );

  return mapProgram(created.toObject(), institution, requester);
};

export const listInstitutionMentorshipPrograms = async (
  institutionId: string,
  institutionType: 'school' | 'college',
): Promise<InstitutionMentorshipProgramView> => {
  await assertInstitutionRequester(institutionId, institutionType, institutionId);

  const programs = await InstitutionMentorshipProgram.find({ institutionId, institutionType })
    .sort({ createdAt: -1 })
    .lean();
  const items = await toProgramViews(programs);

  return {
    items,
    stats: buildStats(items),
  };
};

export const createAdminInstitutionMentorshipProgram = async (
  adminId: string,
  payload: AdminCreateInstitutionMentorshipProgramInput,
): Promise<InstitutionMentorshipProgramItem> => {
  const admin = await User.findById(adminId).select('_id role displayName email').lean();
  if (!admin || admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can create institution mentorship programs');
  }

  const [{ institution, institutionType }, mentor] = await Promise.all([
    assertInstitutionAccount(payload.institutionId),
    assertAssignableMentor(payload.mentorId),
  ]);

  const created = await InstitutionMentorshipProgram.create({
    institutionId: institution._id,
    institutionType,
    requestedBy: institution._id,
    mentorId: mentor._id,
    title: sanitizePlainText(payload.title),
    objective: sanitizePlainText(payload.objective),
    preferredDate: new Date(payload.preferredDate),
    scheduledAt: new Date(payload.scheduledAt),
    durationMinutes: payload.durationMinutes,
    expectedParticipants: payload.expectedParticipants,
    deliveryMode: payload.deliveryMode,
    platform: payload.platform,
    ...(payload.meetingLink ? { meetingLink: payload.meetingLink } : {}),
    ...(payload.venue ? { venue: sanitizePlainText(payload.venue) } : {}),
    ...(payload.preferredExpertise ? { preferredExpertise: sanitizePlainText(payload.preferredExpertise) } : {}),
    ...(payload.adminNotes ? { adminNotes: sanitizePlainText(payload.adminNotes) } : {}),
    status: 'Assigned',
  });

  await invalidateInstitutionMentorshipCaches(String(institution._id));

  await Promise.all([
    NotificationService.create({
      userId: String(mentor._id),
      type: 'system',
      title: 'New institution mentorship assignment',
      body: `You were assigned to "${created.title}" for an institution mentorship session.`,
      link: '/dashboard/mentor',
    }),
    NotificationService.create({
      userId: String(institution._id),
      type: 'system',
      title: 'Mentorship program scheduled',
      body: `Admin scheduled "${created.title}" with ${mentor.displayName}.`,
      link: institution.role === UserRole.COLLEGE ? '/dashboard/college' : '/dashboard/school',
    }),
  ]);

  if (io) {
    io.of('/notifications').to(`user:${String(mentor._id)}`).emit('notification:new');
  }

  return mapProgram(
    created.toObject(),
    institution,
    {
      _id: institution._id,
      displayName: institution.displayName,
      email: institution.email,
    },
    mentor,
  );
};

export const listAdminMentorshipPrograms = async (status?: 'Pending' | 'Assigned' | 'Rejected'): Promise<InstitutionMentorshipProgramListResponse> => {
  const programs = await InstitutionMentorshipProgram.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .lean();
  const items = await toProgramViews(programs);

  return {
    items,
    stats: buildStats(items),
  };
};

export const listMentorAssignedInstitutionPrograms = async (
  mentorId: string,
): Promise<MentorAssignedInstitutionProgram[]> => {
  const programs = await InstitutionMentorshipProgram.find({
    mentorId: new Types.ObjectId(mentorId),
    status: 'Assigned',
  })
    .sort({ scheduledAt: 1, createdAt: -1 })
    .lean();

  if (programs.length === 0) {
    return [];
  }

  const institutionIds = Array.from(new Set(programs.map((program) => String(program.institutionId))));
  const institutionMap = await loadAssignmentUsers(institutionIds);

  return programs.map((program) => {
    const institution = institutionMap.get(String(program.institutionId));

    return {
      _id: String(program._id),
      institution: {
        _id: String(program.institutionId),
        displayName: institution?.institutionProfile?.institutionName ?? institution?.displayName ?? 'Institution',
        type: program.institutionType,
      },
      title: program.title,
      objective: program.objective,
      preferredDate: toIso(program.preferredDate),
      ...(program.scheduledAt ? { scheduledAt: toIso(program.scheduledAt) } : {}),
      durationMinutes: program.durationMinutes,
      expectedParticipants: program.expectedParticipants,
      deliveryMode: program.deliveryMode,
      platform: program.platform,
      ...(program.meetingLink ? { meetingLink: program.meetingLink } : {}),
      ...(program.venue ? { venue: program.venue } : {}),
      ...(program.adminNotes ? { adminNotes: program.adminNotes } : {}),
      ...(program.preferredExpertise ? { preferredExpertise: program.preferredExpertise } : {}),
      status: 'Assigned',
    };
  });
};

export const listMentorAssignedProjects = async (mentorId: string): Promise<MentorAssignedProject[]> => {
  const workspaces = (await Workspace.find({
    isActive: true,
    chatParticipants: {
      $elemMatch: {
        userId: new Types.ObjectId(mentorId),
        role: 'mentor',
      },
    },
  })
    .select('_id ownerId teamMemberIds title category stage progressPercent chatParticipants updatedAt')
    .sort({ updatedAt: -1 })
    .lean()) as WorkspaceMentorSnapshot[];

  if (workspaces.length === 0) {
    return [];
  }

  const workspaceIds = workspaces.map((workspace) => String(workspace._id));
  const startups = await Startup.find({
    projectId: { $in: workspaceIds },
  })
    .select('_id name projectId')
    .lean();
  const startupMap = new Map(
    startups
      .filter((startup) => startup.projectId)
      .map((startup) => [String(startup.projectId), startup]),
  );

  const userIds = Array.from(
    new Set(workspaces.flatMap((workspace) => getWorkspaceStudentIds(workspace))),
  );
  const userMap = await loadAssignmentUsers(userIds);

  return workspaces.map((workspace) => mapMentorAssignedProject(workspace, startupMap, userMap));
};

export const listAdminProjectMentorships = async (): Promise<AdminProjectMentorshipView> => {
  const { workspaces, startupMap } = await listProjectMentorshipWorkspaces();

  if (workspaces.length === 0) {
    return {
      items: [],
      stats: {
        total: 0,
        assigned: 0,
        unassigned: 0,
      },
    };
  }

  const userIds = Array.from(
    new Set(
      workspaces.flatMap((workspace) => [
        ...getWorkspaceStudentIds(workspace),
        ...(getWorkspaceMentorParticipant(workspace) ? [String(getWorkspaceMentorParticipant(workspace)?.userId)] : []),
      ]),
    ),
  );
  const userMap = await loadAssignmentUsers(userIds);
  const items = workspaces.map((workspace) => mapAdminProjectMentorshipItem(workspace, startupMap, userMap));

  return {
    items,
    stats: {
      total: items.length,
      assigned: items.filter((item) => item.mentor).length,
      unassigned: items.filter((item) => !item.mentor).length,
    },
  };
};

export const reviewInstitutionMentorshipProgram = async (
  adminId: string,
  programId: string,
  payload: InstitutionMentorshipProgramReviewInput,
): Promise<InstitutionMentorshipProgramItem> => {
  const admin = await User.findById(adminId).select('_id role displayName').lean();
  if (!admin || admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can review mentorship requests');
  }

  const program = await InstitutionMentorshipProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'MENTORSHIP_PROGRAM_NOT_FOUND', 'Mentorship program request not found');
  }

  if (payload.decision === 'rejected') {
    program.status = 'Rejected';
    program.mentorId = undefined;
    program.scheduledAt = undefined;
    program.meetingLink = undefined;
    program.venue = undefined;
    program.adminNotes = payload.adminNotes ? sanitizePlainText(payload.adminNotes) : undefined;
    program.rejectionReason = sanitizePlainText(payload.rejectionReason);
  } else {
    const mentor = await assertAssignableMentor(payload.mentorId);

    program.status = 'Assigned';
    program.mentorId = new Types.ObjectId(payload.mentorId);
    program.scheduledAt = new Date(payload.scheduledAt);
    program.deliveryMode = payload.deliveryMode;
    program.platform = payload.platform;
    program.meetingLink = payload.meetingLink || undefined;
    program.venue = payload.venue ? sanitizePlainText(payload.venue) : undefined;
    program.adminNotes = payload.adminNotes ? sanitizePlainText(payload.adminNotes) : undefined;
    program.rejectionReason = undefined;

    await NotificationService.create({
      userId: String(mentor._id),
      type: 'system',
      title: 'New institution mentorship assignment',
      body: `You were assigned to "${program.title}" for an institution mentorship session.`,
      link: '/dashboard/mentor',
    });

    if (io) {
      io.of('/notifications').to(`user:${String(mentor._id)}`).emit('notification:new');
    }
  }

  await program.save();
  await invalidateInstitutionMentorshipCaches(String(program.institutionId));

  const institution = await User.findById(program.institutionId)
    .select('_id displayName institutionProfile')
    .lean();
  const requester = await User.findById(program.requestedBy).select('_id displayName email').lean();
  const mentor = program.mentorId
    ? await User.findById(program.mentorId).select('_id displayName email avatar domain bio').lean()
    : undefined;

  await NotificationService.create({
    userId: String(program.institutionId),
    type: 'system',
    title:
      payload.decision === 'assigned'
        ? 'Mentorship program scheduled'
        : 'Mentorship program request reviewed',
    body:
      payload.decision === 'assigned'
        ? `Your mentorship session "${program.title}" has been scheduled.`
        : program.rejectionReason ?? 'Your mentorship request was reviewed by admin.',
    link:
      institution?.role === UserRole.COLLEGE
        ? '/dashboard/college'
        : '/dashboard/school',
  });

  return mapProgram(
    program.toObject(),
    institution ?? { _id: program.institutionId, displayName: 'Institution' },
    requester ?? { _id: program.requestedBy, displayName: 'Requester', email: '' },
    mentor ?? undefined,
  );
};

export const assignProjectMentor = async (
  adminId: string,
  workspaceId: string,
  payload: ProjectMentorAssignmentInput,
): Promise<AdminProjectMentorshipItem> => {
  const admin = await User.findById(adminId).select('_id role displayName').lean();
  if (!admin || admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can manage project mentor assignments');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Project workspace not found');
  }

  const studentIds = getWorkspaceStudentIds({
    ownerId: workspace.ownerId,
    teamMemberIds: workspace.teamMemberIds,
  });
  const existingMentor = workspace.chatParticipants.find((participant) => participant.role === 'mentor');

  if (payload.decision === 'unassigned') {
    workspace.chatParticipants = workspace.chatParticipants.filter((participant) => participant.role !== 'mentor');
    await workspace.save();

    if (existingMentor) {
      const existingMentorId = String(existingMentor.userId);
      await removeMentorWatchersForWorkspace(existingMentorId, workspaceId, studentIds);
      await NotificationService.create({
        userId: existingMentorId,
        type: 'system',
        title: 'Project mentorship assignment removed',
        body: `Admin removed your mentor assignment from "${workspace.title}".`,
        link: '/dashboard/mentor',
      });
    }
  } else {
    const mentor = await User.findOne({
      _id: payload.mentorId,
      role: UserRole.MENTOR,
      isActive: true,
      adminApprovalStatus: { $in: ['approved', 'not_required'] },
    })
      .select('_id displayName')
      .lean();

    if (!mentor) {
      throw new ApiError(404, 'MENTOR_NOT_FOUND', 'Assigned mentor not found');
    }

    workspace.chatParticipants = workspace.chatParticipants.filter((participant) => participant.role !== 'mentor');
    workspace.chatParticipants.push({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(payload.mentorId),
      role: 'mentor',
      addedBy: new Types.ObjectId(adminId),
      addedAt: new Date(),
    });
    await workspace.save();

    await addMentorWatchers(payload.mentorId, studentIds);

    if (existingMentor && String(existingMentor.userId) !== payload.mentorId) {
      await removeMentorWatchersForWorkspace(String(existingMentor.userId), workspaceId, studentIds);
      await NotificationService.create({
        userId: String(existingMentor.userId),
        type: 'system',
        title: 'Project mentorship assignment updated',
        body: `Admin reassigned "${workspace.title}" to another mentor.`,
        link: '/dashboard/mentor',
      });
    }

    await NotificationService.create({
      userId: payload.mentorId,
      type: 'system',
      title: 'New project mentorship assignment',
      body: `Admin assigned you to mentor "${workspace.title}".`,
      link: '/dashboard/mentor',
    });
  }

  const workspacePath = `/product-workspace/${workspaceId}`;
  await Promise.all(
    studentIds.map((studentId) =>
      NotificationService.create({
        userId: studentId,
        type: 'system',
        title:
          payload.decision === 'assigned'
            ? 'Mentor assigned to your project'
            : 'Project mentor assignment updated',
        body:
          payload.decision === 'assigned'
            ? `Admin assigned a mentor to "${workspace.title}".`
            : `Admin removed the mentor assignment from "${workspace.title}".`,
        link: workspacePath,
      }),
    ),
  );

  const { startupMap } = await listProjectMentorshipWorkspaces();
  const userIds = Array.from(
    new Set([
      ...studentIds,
      ...(payload.decision === 'assigned'
        ? [payload.mentorId]
        : existingMentor
          ? [String(existingMentor.userId)]
          : []),
    ]),
  );
  const userMap = await loadAssignmentUsers(userIds);

  return mapAdminProjectMentorshipItem(
    {
      _id: workspace._id,
      ownerId: workspace.ownerId,
      teamMemberIds: workspace.teamMemberIds,
      title: workspace.title,
      category: workspace.category,
      stage: workspace.stage,
      progressPercent: workspace.progressPercent,
      chatParticipants: workspace.chatParticipants,
      updatedAt: workspace.updatedAt,
    },
    startupMap,
    userMap,
  );
};

export const listAdminMentors = async (): Promise<MentorshipAdminMentorItem[]> => {
  const mentors = await User.find({
    role: UserRole.MENTOR,
    isActive: true,
    adminApprovalStatus: { $in: ['not_required', 'approved'] },
  })
    .select('_id displayName email avatar domain bio headline createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const mentorIds = mentors.map((mentor) => mentor._id);
  const [programAssignmentCounts, projectAssignmentCounts] = await Promise.all([
    mentorIds.length > 0
      ? await InstitutionMentorshipProgram.aggregate<{ _id: Types.ObjectId; count: number }>([
          {
            $match: {
              mentorId: { $in: mentorIds },
              status: 'Assigned',
            },
          },
          {
            $group: {
              _id: '$mentorId',
              count: { $sum: 1 },
            },
          },
        ])
      : [],
    mentorIds.length > 0
      ? await Workspace.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $unwind: '$chatParticipants' },
          {
            $match: {
              isActive: true,
              'chatParticipants.role': 'mentor',
              'chatParticipants.userId': { $in: mentorIds },
            },
          },
          {
            $group: {
              _id: '$chatParticipants.userId',
              count: { $sum: 1 },
            },
          },
        ])
      : [],
  ]);
  const programCountMap = new Map(programAssignmentCounts.map((entry) => [String(entry._id), entry.count]));
  const projectCountMap = new Map(projectAssignmentCounts.map((entry) => [String(entry._id), entry.count]));

  return mentors.map((mentor) => ({
    _id: String(mentor._id),
    displayName: mentor.displayName,
    email: mentor.email,
    ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
    ...(mentor.domain ? { domain: mentor.domain } : {}),
    ...(mentor.bio ? { bio: mentor.bio } : {}),
    ...(mentor.headline ? { headline: mentor.headline } : {}),
    assignedProjects: projectCountMap.get(String(mentor._id)) ?? 0,
    assignedPrograms: programCountMap.get(String(mentor._id)) ?? 0,
    createdAt: toIso(mentor.createdAt),
  }));
};

export const createAdminMentorProfile = async (
  adminId: string,
  payload: CreateMentorProfileInput,
): Promise<CreatedMentorProfileResult> => {
  const admin = await User.findById(adminId).select('_id role').lean();
  if (!admin || admin.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can create mentor profiles');
  }

  const normalizedEmail = payload.email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const profileSlug = await generateProfileSlug(sanitizedDisplayName);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const mentor = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: UserRole.MENTOR,
    displayName: sanitizedDisplayName,
    profileSlug,
    ...(payload.domain ? { domain: sanitizePlainText(payload.domain) } : {}),
    ...(payload.bio ? { bio: sanitizePlainText(payload.bio) } : {}),
    ...(payload.headline ? { headline: sanitizePlainText(payload.headline) } : {}),
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: true,
    profileComplete: Boolean(payload.domain || payload.bio),
    registrationStage: 'basic',
    adminApprovalStatus: 'approved',
    adminApprovedAt: new Date(),
    adminApprovedBy: new Types.ObjectId(adminId),
    mustChangePasswordOnNextLogin: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: 'not_required',
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
