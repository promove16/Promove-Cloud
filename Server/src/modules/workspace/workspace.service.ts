import { Types } from 'mongoose';
import { z } from 'zod';
import { deleteFromCloudinary, uploadToCloudinary } from '../../services/cloudinaryService';
import { sendTeamInviteEmail } from '../../services/emailService';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { ChatMessage } from '../chat/chat.model';
import { Workspace } from './workspace.model';
import { ApiError } from '../../utils/ApiError';

const objectId = (value: string) => new Types.ObjectId(value);

export const createWorkspaceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(100),
  claimedProblemId: z.string().optional(),
});

export const updateWorkspaceSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  stage: z.enum(['Ideation', 'Problem', 'Build', 'Patent', 'Launch']).optional(),
});

export const addProgressSchema = z.object({
  note: z.string().trim().min(5).max(500),
  milestoneRef: z.string().optional(),
  completionPercent: z.number().min(0).max(100).optional(),
});

export const addTaskSchema = z.object({
  title: z.string().trim().min(2).max(120),
  priority: z.enum(['High', 'Medium', 'Low']),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export const addRepoSubmissionSchema = z.object({
  repoUrl: z.string().trim().url().max(300),
  branch: z.string().trim().max(120).optional(),
  commitHash: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{7,40}$/i, 'Commit hash must be 7 to 40 hex characters')
    .optional(),
  note: z.string().trim().max(300).optional(),
});

export const addCodeSubmissionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  language: z.string().trim().min(1).max(60),
  summary: z.string().trim().max(300).optional(),
  codeSnippet: z.string().trim().min(10).max(8000),
});

export const inviteMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
  })
  .refine((value) => value.email || value.userId, {
    message: 'Email or userId is required',
  });

export const addChatParticipantSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
    role: z.enum(['mentor', 'investor']),
  })
  .refine((value) => value.email || value.userId, {
    message: 'Email or userId is required',
  });

const HIGH_CONFIDENCE_SECRET_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, message: 'Private keys are not allowed in code submissions.' },
  { pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/, message: 'GitHub tokens are not allowed in code submissions.' },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/, message: 'GitHub personal access tokens are not allowed in code submissions.' },
  { pattern: /AKIA[0-9A-Z]{16}/, message: 'AWS access keys are not allowed in code submissions.' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, message: 'Google API keys are not allowed in code submissions.' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/, message: 'Slack tokens are not allowed in code submissions.' },
  { pattern: /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^/\s@]+@/i, message: 'Database credentials are not allowed in code submissions.' },
];

const countLines = (value: string) => value.split(/\r\n|\r|\n/).length;

const assertCodeSubmissionIsSafe = (codeSnippet: string) => {
  for (const rule of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    if (rule.pattern.test(codeSnippet)) {
      throw new ApiError(400, 'SENSITIVE_CODE_BLOCKED', rule.message);
    }
  }
};

const normalizeGithubRepoUrl = (repoUrl: string) => {
  let parsed: URL;

  try {
    parsed = new URL(repoUrl);
  } catch (_error) {
    throw new ApiError(400, 'INVALID_REPOSITORY_URL', 'Enter a valid GitHub repository URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!['github.com', 'www.github.com'].includes(hostname)) {
    throw new ApiError(400, 'INVALID_REPOSITORY_URL', 'Only GitHub repository links are allowed.');
  }
  if (parsed.protocol !== 'https:') {
    throw new ApiError(400, 'INVALID_REPOSITORY_URL', 'Repository links must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new ApiError(400, 'INVALID_REPOSITORY_URL', 'Repository links cannot include embedded credentials.');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new ApiError(400, 'INVALID_REPOSITORY_URL', 'Use a full GitHub repository URL like https://github.com/org/repo.');
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  const normalized = `https://github.com/${owner}/${repo}`;

  return {
    repoUrl: normalized,
    displayName: `${owner}/${repo}`,
  };
};

const recalcProgressPercent = (workspace: { milestones: Array<{ completionPercent: number }> }) => {
  const total = workspace.milestones.reduce((sum, milestone) => sum + milestone.completionPercent, 0);
  return Math.round(total / workspace.milestones.length);
};

type WorkspaceSnapshot = {
  toObject?: () => any;
  ownerId: unknown;
  teamMemberIds: unknown[];
  [key: string]: any;
};

export const serializeWorkspace = async (workspace: WorkspaceSnapshot) => {
  const baseWorkspace: any =
    typeof workspace.toObject === 'function' ? workspace.toObject() : workspace;
  const memberIds = Array.from(
    new Set([
      String(baseWorkspace.ownerId),
      ...baseWorkspace.teamMemberIds.map((memberId: unknown) => String(memberId)),
    ]),
  );
  const teamMembers = await User.find({ _id: { $in: memberIds } })
    .select('_id displayName role avatar')
    .lean();

  const chatParticipantUserIds = (baseWorkspace.chatParticipants || []).map(
    (p: any) => String(p.userId),
  );
  const chatParticipantUsers =
    chatParticipantUserIds.length > 0
      ? await User.find({ _id: { $in: chatParticipantUserIds } })
          .select('_id displayName role avatar')
          .lean()
      : [];
  const chatParticipantUserMap = new Map(
    chatParticipantUsers.map((u) => [String(u._id), u]),
  );

  return {
    ...baseWorkspace,
    tasks: baseWorkspace.tasks || [],
    uploads: baseWorkspace.uploads || [],
    repoSubmissions: baseWorkspace.repoSubmissions || [],
    codeSubmissions: baseWorkspace.codeSubmissions || [],
    progressUpdates: baseWorkspace.progressUpdates || [],
    milestones: baseWorkspace.milestones || [],
    teamMembers: teamMembers.map((member) => ({
      _id: String(member._id),
      displayName: member.displayName,
      role: member.role,
      ...(member.avatar ? { avatar: member.avatar } : {}),
    })),
    chatParticipants: (baseWorkspace.chatParticipants || []).map((p: any) => {
      const user = chatParticipantUserMap.get(String(p.userId));
      return {
        _id: String(p._id),
        userId: String(p.userId),
        role: p.role,
        addedBy: String(p.addedBy),
        addedAt: p.addedAt,
        displayName: user?.displayName ?? null,
        avatar: user?.avatar ?? null,
      };
    }),
  };
};

export const getAccessibleWorkspaces = async (userId: string) => {
  const workspaces = await Workspace.find({
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  return Promise.all(workspaces.map((workspace) => serializeWorkspace(workspace)));
};

export const getWorkspaceForMember = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const memberIds = new Set([
    String(workspace.ownerId),
    ...workspace.teamMemberIds.map((memberId) => String(memberId)),
  ]);

  if (!memberIds.has(String(userId))) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  return workspace;
};

export const getWorkspaceForOwner = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner can do that.');
  }

  if (String(workspace.ownerId) !== String(userId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner can do that.');
  }

  return workspace;
};

export const getWorkspaceForChatAccess = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isMember =
    String(workspace.ownerId) === String(userId) ||
    workspace.teamMemberIds.some((id) => String(id) === String(userId)) ||
    workspace.chatParticipants.some((p) => String(p.userId) === String(userId));

  if (!isMember) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  return workspace;
};

export const createWorkspace = async (
  userId: string,
  payload: z.infer<typeof createWorkspaceSchema>,
) => {
  const activeCount = await Workspace.countDocuments({ ownerId: userId, isActive: true });
  if (activeCount >= 3) {
    throw new ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
  }

  const workspace = await Workspace.create({
    ownerId: userId,
    teamMemberIds: [userId],
    title: payload.title,
    category: payload.category,
    claimedProblemId: payload.claimedProblemId ? objectId(payload.claimedProblemId) : undefined,
    stage: payload.claimedProblemId ? 'Problem' : 'Ideation',
  });

  return serializeWorkspace(workspace);
};

export const updateWorkspace = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof updateWorkspaceSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  Object.assign(workspace, payload);
  await workspace.save();
  return serializeWorkspace(workspace);
};

export const deleteWorkspace = async (workspaceId: string, userId: string) => {
  await getWorkspaceForOwner(workspaceId, userId);
  await Workspace.findByIdAndDelete(workspaceId);
  await ChatMessage.deleteMany({ workspaceId });
};

export const addProgress = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof addProgressSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);

  workspace.progressUpdates.push({
    submittedBy: objectId(userId),
    note: payload.note,
    milestoneRef: payload.milestoneRef,
    submittedAt: new Date(),
    _id: new Types.ObjectId(),
  });

  if (payload.milestoneRef && payload.completionPercent !== undefined) {
    const milestone = workspace.milestones.find((item) => item.name === payload.milestoneRef);
    if (milestone) {
      milestone.completionPercent = payload.completionPercent;
      milestone.isCompleted = payload.completionPercent >= 100;
      milestone.completedAt = milestone.isCompleted ? new Date() : undefined;
      milestone.completedBy = milestone.isCompleted ? objectId(userId) : undefined;
    }
  }

  workspace.progressPercent = recalcProgressPercent(workspace);
  await workspace.save();

  await applyScoreAsync({
    userId,
    trigger: 'PROGRESS_UPLOADED',
    metadata: { workspaceId, milestoneRef: payload.milestoneRef },
  });

  return serializeWorkspace(workspace);
};

export const uploadWorkspaceFile = async (
  workspaceId: string,
  userId: string,
  file: Express.Multer.File,
  note?: string,
  category?: string,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
  const upload = await uploadToCloudinary(
    file.buffer,
    'promove/workspaces',
    fileType === 'pdf' ? 'raw' : 'image',
    fileType === 'pdf' ? { format: 'pdf' } : undefined,
  );

  const allowedCategories = ['bug_report', 'error_log', 'screenshot', 'test_result', 'design_mockup', 'other'];
  const safeCategory = category && allowedCategories.includes(category) ? category : 'other';

  workspace.uploads.push({
    _id: new Types.ObjectId(),
    fileUrl: upload.secure_url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedBy: objectId(userId),
    uploadedAt: new Date(),
    note,
    category: safeCategory,
    cloudinaryPublicId: upload.public_id,
  });
  await workspace.save();
  return workspace.uploads;
};

export const deleteWorkspaceUpload = async (workspaceId: string, uploadId: string, userId: string) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const upload = workspace.uploads.find((item) => String(item._id) === uploadId);
  if (!upload) {
    throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
  }

  if (upload.cloudinaryPublicId) {
    await deleteFromCloudinary(
      upload.cloudinaryPublicId,
      upload.fileType === 'pdf' ? 'raw' : 'image',
    );
  }

  workspace.uploads = workspace.uploads.filter((item) => String(item._id) !== uploadId);
  await workspace.save();
  return workspace.uploads;
};

export const addRepoSubmission = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof addRepoSubmissionSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const normalizedRepo = normalizeGithubRepoUrl(payload.repoUrl);

  if (workspace.repoSubmissions.length >= 10) {
    throw new ApiError(400, 'REPO_SUBMISSION_LIMIT_REACHED', 'You cannot attach more repository links to this workspace.');
  }

  workspace.repoSubmissions.push({
    _id: new Types.ObjectId(),
    provider: 'github',
    repoUrl: normalizedRepo.repoUrl,
    displayName: normalizedRepo.displayName,
    branch: payload.branch,
    commitHash: payload.commitHash,
    note: payload.note,
    uploadedBy: objectId(userId),
    uploadedAt: new Date(),
  });

  await workspace.save();
  return serializeWorkspace(workspace);
};

export const deleteRepoSubmission = async (workspaceId: string, repoId: string, userId: string) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const repo = workspace.repoSubmissions.find((item) => String(item._id) === repoId);
  if (!repo) {
    throw new ApiError(404, 'REPOSITORY_NOT_FOUND', 'Repository submission not found');
  }

  workspace.repoSubmissions = workspace.repoSubmissions.filter((item) => String(item._id) !== repoId);
  await workspace.save();
  return serializeWorkspace(workspace);
};

export const addCodeSubmission = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof addCodeSubmissionSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  assertCodeSubmissionIsSafe(payload.codeSnippet);

  const lineCount = countLines(payload.codeSnippet);
  if (lineCount > 500) {
    throw new ApiError(400, 'CODE_SUBMISSION_TOO_LARGE', 'Code submissions must be 500 lines or fewer.');
  }

  workspace.codeSubmissions.push({
    _id: new Types.ObjectId(),
    title: payload.title,
    language: payload.language,
    summary: payload.summary,
    codeSnippet: payload.codeSnippet,
    lineCount,
    uploadedBy: objectId(userId),
    uploadedAt: new Date(),
  });

  await workspace.save();
  return serializeWorkspace(workspace);
};

export const deleteCodeSubmission = async (workspaceId: string, codeId: string, userId: string) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const submission = workspace.codeSubmissions.find((item) => String(item._id) === codeId);
  if (!submission) {
    throw new ApiError(404, 'CODE_SUBMISSION_NOT_FOUND', 'Code submission not found');
  }

  workspace.codeSubmissions = workspace.codeSubmissions.filter((item) => String(item._id) !== codeId);
  await workspace.save();
  return serializeWorkspace(workspace);
};

export const addTask = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof addTaskSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  workspace.tasks.push({
    _id: new Types.ObjectId(),
    title: payload.title,
    priority: payload.priority,
    assignedTo: payload.assignedTo ? objectId(payload.assignedTo) : undefined,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    done: false,
    createdAt: new Date(),
  });
  await workspace.save();
  return workspace.tasks;
};

export const updateTask = async (
  workspaceId: string,
  taskId: string,
  userId: string,
  payload: Partial<z.infer<typeof addTaskSchema>> & { done?: boolean },
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const task = workspace.tasks.find((item) => String(item._id) === taskId);
  if (!task) {
    throw new ApiError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  if (payload.title !== undefined) task.title = payload.title;
  if (payload.priority !== undefined) task.priority = payload.priority;
  if (payload.assignedTo !== undefined) task.assignedTo = payload.assignedTo ? objectId(payload.assignedTo) : undefined;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
  if (payload.done !== undefined) task.done = payload.done;

  await workspace.save();
  return workspace.tasks;
};

export const deleteTask = async (workspaceId: string, taskId: string, userId: string) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const task = workspace.tasks.find((item) => String(item._id) === taskId);
  if (!task) {
    throw new ApiError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  workspace.tasks = workspace.tasks.filter((item) => String(item._id) !== taskId);
  await workspace.save();
  return workspace.tasks;
};

export const inviteMember = async (
  workspaceId: string,
  ownerId: string,
  payload: z.infer<typeof inviteMemberSchema>,
) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);
  if (workspace.teamMemberIds.length >= 5) {
    throw new ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
  }

  let user = payload.userId ? await User.findById(payload.userId) : null;
  if (!user && payload.email) {
    user = await User.findOne({ email: payload.email.toLowerCase() });
  }

  if (user) {
    if (workspace.teamMemberIds.some((memberId) => String(memberId) === String(user?._id))) {
      throw new ApiError(400, 'MEMBER_ALREADY_EXISTS', 'That member is already on the team.');
    }

    workspace.teamMemberIds.push(user._id);
    await workspace.save();
    await notificationQueue.add('team-invite', {
      userId: String(user._id),
      type: 'team_invite',
      title: 'New workspace invite',
      body: `You were added to ${workspace.title}.`,
      link: `/product-workspace/${workspaceId}`,
    });

    return serializeWorkspace(workspace);
  }

  if (!payload.email) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const inviter = await User.findById(ownerId).select('displayName').lean();
  await sendTeamInviteEmail({
    toEmail: payload.email,
    inviterName: inviter?.displayName ?? 'A ProMove collaborator',
    workspaceTitle: workspace.title,
    inviteLink: `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/signup`,
  });

  return serializeWorkspace(workspace);
};

export const removeMember = async (workspaceId: string, memberId: string, ownerId: string) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);
  workspace.teamMemberIds = workspace.teamMemberIds.filter((id) => String(id) !== memberId);
  await workspace.save();
  return serializeWorkspace(workspace);
};

export const getWorkspaceChatHistory = async (workspaceId: string, userId: string, before?: string, limit = 50) => {
  await getWorkspaceForChatAccess(workspaceId, userId);
  const filter: Record<string, unknown> = { workspaceId };
  if (before) {
    filter._id = { $lt: before };
  }
  return ChatMessage.find(filter).sort({ sentAt: -1 }).limit(limit).lean();
};

export const addChatParticipant = async (
  workspaceId: string,
  ownerId: string,
  payload: z.infer<typeof addChatParticipantSchema>,
) => {
  if (payload.role === 'mentor') {
    throw new ApiError(
      403,
      'MENTOR_ASSIGNMENT_ADMIN_ONLY',
      'Mentor assignments are managed by admin. Students can only add investor participants.',
    );
  }

  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);

  let user = payload.userId ? await User.findById(payload.userId) : null;
  if (!user && payload.email) {
    user = await User.findOne({ email: payload.email.toLowerCase() });
  }

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.role !== payload.role) {
    throw new ApiError(400, 'ROLE_MISMATCH', `User's role is '${user.role}', but '${payload.role}' was specified.`);
  }

  const alreadyParticipant = workspace.chatParticipants.some(
    (p) => String(p.userId) === String(user!._id),
  );
  if (alreadyParticipant) {
    throw new ApiError(400, 'PARTICIPANT_ALREADY_EXISTS', 'That user is already a chat participant.');
  }

  const alreadyMember = workspace.teamMemberIds.some(
    (id) => String(id) === String(user!._id),
  );
  if (alreadyMember) {
    throw new ApiError(400, 'MEMBER_ALREADY_EXISTS', 'That user is already a team member.');
  }

  workspace.chatParticipants.push({
    _id: new Types.ObjectId(),
    userId: user._id,
    role: payload.role,
    addedBy: objectId(ownerId),
    addedAt: new Date(),
  });
  await workspace.save();

  await notificationQueue.add('chat-participant-invite', {
    userId: String(user._id),
    type: 'chat_invite',
    title: 'You have been invited to a workspace chat',
    body: `You were granted chat access to ${workspace.title}.`,
    link: `/product-workspace/${workspaceId}`,
  });

  return serializeWorkspace(workspace);
};

export const removeChatParticipant = async (
  workspaceId: string,
  ownerId: string,
  participantUserId: string,
) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);
  const participant = workspace.chatParticipants.find((p) => String(p.userId) === participantUserId);
  if (!participant) {
    throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Chat participant not found');
  }

  if (participant.role === 'mentor') {
    throw new ApiError(
      403,
      'MENTOR_ASSIGNMENT_ADMIN_ONLY',
      'Mentor assignments are managed by admin and cannot be removed from the student workspace.',
    );
  }

  workspace.chatParticipants = workspace.chatParticipants.filter(
    (p) => String(p.userId) !== participantUserId,
  );
  await workspace.save();
  return serializeWorkspace(workspace);
};
