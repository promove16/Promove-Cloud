import { Types } from 'mongoose';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { sendTeamInviteEmail } from '../../services/emailService';
import {
  buildContentDisposition,
  deleteStoredAsset,
  generatePresignedUrl,
  uploadFile,
  validateFileContent,
} from '../../services/fileStorageService';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import { applyScoreAsync } from '../../services/scoreEngine';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/user.model';
import { ChatMessage } from '../chat/chat.model';
import { serializeChatMessage } from '../chat/chat.serializer';
import { TeamRequest } from '../social/teamRequest.model';
import { RequestRecord } from '../request/request.model';
import {
  acceptRequest,
  createRequest,
  declineRequest,
  registerRequestHandler,
} from '../request/request.service';
import { Deal } from '../deal/deal.model';
import { Patent } from '../patent/patent.model';
import { PatentRequest } from '../patent/patentRequest.model';
import { ProblemSubmission } from '../problemBank/problemSubmission.model';
import { clearProblemCaches } from '../problemBank/problem.service';
import { Startup } from '../startup/startup.model';
import { recordStartupLifecycleEvent } from '../startupLifecycle/startupLifecycle.service';
import { Workspace } from './workspace.model';
import { ApiError } from '../../utils/ApiError';

const objectId = (value: string) => new Types.ObjectId(value);
const TEAM_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ASSIGNABLE_MENTOR_APPROVAL_STATUSES = new Set(['approved', 'not_required']);

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
    message: z.string().trim().max(500).optional(),
    proposedRole: z
      .enum(['developer', 'designer', 'researcher', 'marketer', 'lead', 'other'])
      .default('other'),
    targetRole: z.string().trim().max(80).optional(),
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
  _id?: unknown;
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
    .select('_id displayName role avatar profileSlug')
    .lean();

  const chatParticipantUserIds = (baseWorkspace.chatParticipants || []).map(
    (p: any) => String(p.userId),
  );
  const chatParticipantUsers =
    chatParticipantUserIds.length > 0
      ? await User.find({ _id: { $in: chatParticipantUserIds } })
          .select('_id displayName role avatar profileSlug')
          .lean()
      : [];
  const chatParticipantUserMap = new Map(
    chatParticipantUsers.map((u) => [String(u._id), u]),
  );
  const pendingInvites =
    baseWorkspace._id
      ? await TeamRequest.find({ workspaceId: baseWorkspace._id, status: 'pending' })
          .select('_id toUserId proposedRole status expiresAt createdAt')
          .lean()
      : [];
  const pendingInviteUserIds = pendingInvites.map((invite) => String(invite.toUserId));
  const pendingInviteUsers =
    pendingInviteUserIds.length > 0
      ? await User.find({ _id: { $in: pendingInviteUserIds } }).select('_id displayName email').lean()
      : [];
  const pendingInviteUserMap = new Map(
    pendingInviteUsers.map((user) => [String(user._id), user]),
  );

  return {
    ...baseWorkspace,
    tasks: baseWorkspace.tasks || [],
    uploads: await Promise.all((baseWorkspace.uploads || []).map(async (upload: any) => {
      let signedUrl = upload.fileUrl;
      if (upload.storageProvider === 'cloudinary' && upload.storageKey) {
        try {
          const resourceType = upload.fileType === 'image' ? 'image' : 'raw';
          signedUrl = generateSignedCloudinaryUrl(upload.storageKey, resourceType);
        } catch (error) {
          console.error('Error generating signed URL for workspace upload:', error);
        }
      } else if (upload.storageProvider === 's3' && upload.storageKey) {
        try {
          const shouldPreviewInline = ['pdf', 'image', 'video', 'audio'].includes(upload.fileType);
          signedUrl = await generatePresignedUrl(upload.storageKey, 3600, {
            contentDisposition: buildContentDisposition(
              upload.fileName ?? 'file',
              shouldPreviewInline ? 'inline' : 'attachment',
            ),
            ...(upload.mimeType ? { contentType: upload.mimeType } : {}),
          });
        } catch (error) {
          console.error('Error generating S3 signed URL for workspace upload:', error);
        }
      }
      return {
        ...upload,
        fileUrl: signedUrl,
      };
    })),
    repoSubmissions: baseWorkspace.repoSubmissions || [],
    codeSubmissions: baseWorkspace.codeSubmissions || [],
    progressUpdates: baseWorkspace.progressUpdates || [],
    milestones: baseWorkspace.milestones || [],
    teamMembers: teamMembers.map((member) => ({
      _id: String(member._id),
      displayName: member.displayName,
      role: member.role,
      ...(member.avatar ? { avatar: member.avatar } : {}),
      ...(member.profileSlug ? { profileSlug: member.profileSlug } : {}),
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
        ...(user?.profileSlug ? { profileSlug: user.profileSlug } : {}),
      };
    }),
    pendingInvites: pendingInvites.map((invite) => {
      const user = pendingInviteUserMap.get(String(invite.toUserId));
      return {
        _id: String(invite._id),
        toUserId: String(invite.toUserId),
        displayName: user?.displayName ?? 'Pending member',
        email: user?.email ?? null,
        proposedRole: invite.proposedRole,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      };
    }),
  };
};

export const getAccessibleWorkspaces = async (userId: string) => {
  const workspaces = await Workspace.find({
    $or: [
      { ownerId: userId },
      { teamMemberIds: userId },
      { 'chatParticipants.userId': userId },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  return Promise.all(workspaces.map((workspace) => serializeWorkspace(workspace)));
};

export const ensureDirectWorkspaceChatAccess = async (
  workspaceId: string,
  participantUserId: string,
  role: 'mentor' | 'investor',
) => {
  const [workspace, user] = await Promise.all([
    Workspace.findById(workspaceId),
    User.findById(participantUserId).select('_id role').lean(),
  ]);

  if (!workspace || !workspace.isActive || !user || user.role !== role) {
    return false;
  }

  const normalizedUserId = String(user._id);
  const isOwner = String(workspace.ownerId) === normalizedUserId;
  const alreadyMember = workspace.teamMemberIds.some((id) => String(id) === normalizedUserId);
  const alreadyParticipant = workspace.chatParticipants.some(
    (participant) => String(participant.userId) === normalizedUserId,
  );

  if (isOwner || alreadyMember || alreadyParticipant) {
    return false;
  }

  workspace.chatParticipants.push({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(normalizedUserId),
    role,
    addedBy: new Types.ObjectId(String(workspace.ownerId)),
    addedAt: new Date(),
  });
  await workspace.save();

  return true;
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

const getWorkspaceStudentIds = (workspace: {
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
}) =>
  Array.from(
    new Set([String(workspace.ownerId), ...workspace.teamMemberIds.map((memberId) => String(memberId))]),
  );

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
  if (payload.claimedProblemId) {
    throw new ApiError(
      400,
      'PROBLEM_CLAIM_ENDPOINT_REQUIRED',
      'Start problems from the Problem Bank claim action.',
    );
  }

  const workspace = await Workspace.create({
    ownerId: userId,
    teamMemberIds: [userId],
    title: payload.title,
    category: payload.category,
    stage: 'Ideation',
  });

  await recordStartupLifecycleEvent({
    workspaceId: workspace._id,
    actorId: userId,
    source: 'workspace',
    type: 'WORKSPACE_CREATED',
    title: 'Workspace created',
    description: `${workspace.title} was created for product execution.`,
    status: workspace.stage,
    metadata: {
      title: workspace.title,
      category: workspace.category,
      progressPercent: workspace.progressPercent,
    },
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
  const workspace = await getWorkspaceForOwner(workspaceId, userId);

  const [
    linkedStartup,
    linkedProblemSubmission,
    linkedPatent,
    linkedPatentRequest,
    linkedInvestorDeal,
  ] = await Promise.all([
    Startup.exists({ projectId: workspaceId, isActive: true }),
    ProblemSubmission.exists({ workspaceId }),
    Patent.exists({ workspaceId }),
    PatentRequest.exists({ workspaceId }),
    Deal.exists({ linkedWorkspaceId: workspaceId }),
  ]);

  const dependencyLabels = [
    linkedStartup ? 'startup launch records' : null,
    linkedProblemSubmission ? 'Problem Bank review activity' : null,
    linkedPatent ? 'patent records' : null,
    linkedPatentRequest ? 'patent support requests' : null,
    linkedInvestorDeal ? 'investor deal links' : null,
  ].filter((label): label is string => Boolean(label));

  if (dependencyLabels.length > 0) {
    throw new ApiError(
      400,
      'WORKSPACE_HAS_DEPENDENCIES',
      `This workspace cannot be deleted because it is linked to ${dependencyLabels.join(', ')}.`,
    );
  }

  await Workspace.findByIdAndDelete(workspaceId);
  await ChatMessage.deleteMany({ workspaceId });
  if (workspace.claimedProblemId) {
    await clearProblemCaches();
  }
};

export const addProgress = async (
  workspaceId: string,
  userId: string,
  payload: z.infer<typeof addProgressSchema>,
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const milestoneRef = payload.milestoneRef?.trim();
  const milestone = milestoneRef
    ? workspace.milestones.find((item) => item.name === milestoneRef)
    : undefined;

  if (milestoneRef && !milestone) {
    throw new ApiError(
      400,
      'INVALID_MILESTONE_REF',
      'Progress milestone must match an existing workspace milestone.',
    );
  }

  workspace.progressUpdates.push({
    submittedBy: objectId(userId),
    note: payload.note,
    milestoneRef,
    submittedAt: new Date(),
    _id: new Types.ObjectId(),
  });

  if (milestone && payload.completionPercent !== undefined) {
    milestone.completionPercent = payload.completionPercent;
    milestone.isCompleted = payload.completionPercent >= 100;
    milestone.completedAt = milestone.isCompleted ? new Date() : undefined;
    milestone.completedBy = milestone.isCompleted ? objectId(userId) : undefined;
  }

  workspace.progressPercent = recalcProgressPercent(workspace);
  await workspace.save();

  await applyScoreAsync({
    userId,
    trigger: 'PROGRESS_UPLOADED',
    metadata: { workspaceId, milestoneRef },
    idempotencyKey: `workspace-progress:${workspaceId}:${milestoneRef ?? 'general'}`,
  });

  await recordStartupLifecycleEvent({
    workspaceId: workspace._id,
    actorId: userId,
    source: 'workspace',
    type: 'WORKSPACE_PROGRESS_UPDATED',
    title: 'Workspace progress updated',
    description: payload.note,
    status: workspace.stage,
    metadata: {
      milestoneRef,
      completionPercent: payload.completionPercent,
      progressPercent: workspace.progressPercent,
    },
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

  const getFileType = (mimeType: string, fileName: string): string => {
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName)) return 'image';
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.(doc|docx)$/i.test(fileName)) return 'doc';
    if (mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || /\.(ppt|pptx)$/i.test(fileName)) return 'ppt';
    if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || /\.(xls|xlsx)$/i.test(fileName)) return 'xls';
    if (mimeType.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(fileName)) return 'video';
    if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(fileName)) return 'audio';
    return 'other';
  };

  const fileType = getFileType(
    file.mimetype,
    file.originalname,
  ) as 'pdf' | 'image' | 'doc' | 'ppt' | 'xls' | 'video' | 'audio' | 'other';

  if (!validateFileContent(file.buffer, file.originalname)) {
    throw new ApiError(400, 'INVALID_FILE', 'File contains potentially malicious content or has an unsafe extension');
  }

  const upload = await uploadFile({
    buffer: file.buffer,
    folder: 'promove/workspaces',
    fileName: file.originalname,
    contentType: file.mimetype || 'application/octet-stream',
  });

  const allowedCategories = ['bug_report', 'error_log', 'screenshot', 'test_result', 'design_mockup', 'other'];
  const safeCategory = category && allowedCategories.includes(category) ? category : 'other';

  workspace.uploads.push({
    _id: new Types.ObjectId(),
    fileUrl: upload.url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedBy: objectId(userId),
    uploadedAt: new Date(),
    note,
    category: safeCategory,
    storageProvider: upload.provider,
    storageKey: upload.key,
    mimeType: file.mimetype,
  } as any);
  await workspace.save();
  return workspace.uploads;
};

export const deleteWorkspaceUpload = async (workspaceId: string, uploadId: string, userId: string) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const upload = workspace.uploads.find((item) => String(item._id) === uploadId);
  if (!upload) {
    throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
  }

  await deleteStoredAsset({
    storageProvider: upload.storageProvider,
    storageKey: upload.storageKey,
    cloudinaryPublicId: upload.cloudinaryPublicId,
    legacyCloudinaryResourceType: upload.fileType === 'pdf' ? 'raw' : 'image',
  });

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
  await recordStartupLifecycleEvent({
    workspaceId: workspace._id,
    actorId: userId,
    source: 'workspace',
    type: 'WORKSPACE_TASK_CREATED',
    title: 'Task created',
    description: payload.title,
    status: payload.priority,
    metadata: {
      title: payload.title,
      priority: payload.priority,
      assignedTo: payload.assignedTo,
      dueDate: payload.dueDate,
    },
  });
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
  await recordStartupLifecycleEvent({
    workspaceId: workspace._id,
    actorId: userId,
    source: 'workspace',
    type: payload.done === true ? 'WORKSPACE_TASK_COMPLETED' : 'WORKSPACE_TASK_UPDATED',
    title: payload.done === true ? 'Task completed' : 'Task updated',
    description: task.title,
    status: task.done ? 'done' : 'open',
    metadata: {
      taskId,
      title: task.title,
      priority: task.priority,
      assignedTo: task.assignedTo ? String(task.assignedTo) : undefined,
      dueDate: task.dueDate,
    },
  });
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
  await recordStartupLifecycleEvent({
    workspaceId: workspace._id,
    actorId: userId,
    source: 'workspace',
    type: 'WORKSPACE_TASK_REMOVED',
    title: 'Task removed',
    description: task.title,
    status: 'removed',
    metadata: {
      taskId,
      title: task.title,
    },
  });
  return workspace.tasks;
};

export const inviteMember = async (
  workspaceId: string,
  ownerId: string,
  payload: z.infer<typeof inviteMemberSchema>,
) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);

  let user = payload.userId ? await User.findById(payload.userId) : null;
  if (!user && payload.email) {
    user = await User.findOne({ email: payload.email.toLowerCase() });
  }

  if (user) {
    if (user.role !== 'student') {
      throw new ApiError(
        400,
        'ROLE_NOT_SUPPORTED',
        'Team invites are limited to student collaborators. Use chat access for mentor and investor collaboration.',
      );
    }

    if (workspace.teamMemberIds.some((memberId) => String(memberId) === String(user?._id))) {
      throw new ApiError(400, 'MEMBER_ALREADY_EXISTS', 'That member is already on the team.');
    }
    const pendingInviteCount = await TeamRequest.countDocuments({ workspaceId, status: 'pending' });
    if (workspace.teamMemberIds.length + pendingInviteCount >= 5) {
      throw new ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
    }

    const existingInvite = await TeamRequest.findOne({
      fromUserId: ownerId,
      toUserId: user._id,
      workspaceId,
    });

    if (existingInvite?.status === 'pending') {
      throw new ApiError(409, 'INVITE_ALREADY_PENDING', 'That invite is already pending.');
    }

    const invite =
      existingInvite ??
      new TeamRequest({
        fromUserId: objectId(ownerId),
        toUserId: user._id,
        workspaceId: objectId(workspaceId),
      });

    invite.message = payload.message ?? '';
    invite.proposedRole = payload.proposedRole;
    invite.status = 'pending';
    invite.respondedAt = null;
    invite.expiresAt = new Date(Date.now() + TEAM_REQUEST_TTL_MS);
    await invite.save();

    await Promise.all([
      User.findByIdAndUpdate(ownerId, { $addToSet: { teamRequestsSent: invite._id } }),
      User.findByIdAndUpdate(user._id, { $addToSet: { teamRequestsReceived: invite._id } }),
    ]);

    await createRequest({
      type: 'workspace_member',
      actionType: 'join',
      fromUserId: ownerId,
      toUserId: String(user._id),
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      targetEntityTitle: workspace.title,
      targetRole: payload.targetRole ?? payload.proposedRole,
      requestedRole: payload.targetRole ?? payload.proposedRole,
      message: payload.message,
      deepLink: `/product-workspace/${workspaceId}`,
      acceptRedirect: `/product-workspace/${workspaceId}`,
      expiresAt: invite.expiresAt,
      metadata: {
        workspaceId,
        teamRequestId: String(invite._id),
        targetName: workspace.title,
        workspaceTitle: workspace.title,
      },
    });

    return serializeWorkspace(workspace);
  }

  if (!payload.email) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const inviter = await User.findById(ownerId).select('displayName').lean();
  const request = await createRequest({
    type: 'workspace_member',
    actionType: 'join',
    fromUserId: ownerId,
    recipientEmail: payload.email,
    targetEntityType: 'workspace',
    targetEntityId: workspaceId,
    targetEntityTitle: workspace.title,
    targetRole: payload.targetRole ?? payload.proposedRole,
    requestedRole: payload.targetRole ?? payload.proposedRole,
    message: payload.message,
    deepLink: `/product-workspace/${workspaceId}`,
    acceptRedirect: `/product-workspace/${workspaceId}`,
    metadata: {
      workspaceId,
      targetName: workspace.title,
      workspaceTitle: workspace.title,
    },
  });

  await sendTeamInviteEmail({
    toEmail: payload.email,
    inviterName: inviter?.displayName ?? 'A ProMove collaborator',
    workspaceTitle: workspace.title,
    inviteLink: `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/signup?requestId=${String(request._id)}`,
  });

  return serializeWorkspace(workspace);
};

export const removeMember = async (workspaceId: string, memberId: string, ownerId: string) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);
  workspace.teamMemberIds = workspace.teamMemberIds.filter((id) => String(id) !== memberId);
  await workspace.save();
  return serializeWorkspace(workspace);
};

const getInviteForRecipient = async (workspaceId: string, requestId: string, userId: string) => {
  const invite = await TeamRequest.findOne({
    _id: requestId,
    workspaceId,
    toUserId: userId,
  });

  if (!invite) {
    throw new ApiError(404, 'TEAM_INVITE_NOT_FOUND', 'Team invite not found');
  }

  if (invite.status !== 'pending') {
    throw new ApiError(400, 'TEAM_INVITE_NOT_ACTIONABLE', 'This invite is no longer pending.');
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    invite.status = 'expired';
    invite.respondedAt = new Date();
    await invite.save();
    throw new ApiError(400, 'TEAM_INVITE_EXPIRED', 'This invite has expired.');
  }

  return invite;
};

export const acceptMemberInvite = async (workspaceId: string, requestId: string, userId: string) => {
  const requestRecord = await RequestRecord.findOne({
    _id: requestId,
    type: 'workspace_member',
    targetEntityType: 'workspace',
    targetEntityId: workspaceId,
  }).lean();

  if (requestRecord) {
    const actor = await User.findById(userId).select('email').lean();
    await acceptRequest(requestId, userId, actor?.email ?? '');
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return serializeWorkspace(workspace);
  }

  const invite = await getInviteForRecipient(workspaceId, requestId, userId);
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === String(userId));
  if (!isMember) {
    if (workspace.teamMemberIds.length >= 5) {
      throw new ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
    }

    workspace.teamMemberIds.push(objectId(userId));
    await workspace.save();
  }

  invite.status = 'accepted';
  invite.respondedAt = new Date();
  await invite.save();

  return serializeWorkspace(workspace);
};

export const declineMemberInvite = async (workspaceId: string, requestId: string, userId: string) => {
  const requestRecord = await RequestRecord.findOne({
    _id: requestId,
    type: 'workspace_member',
    targetEntityType: 'workspace',
    targetEntityId: workspaceId,
  }).lean();

  if (requestRecord) {
    const actor = await User.findById(userId).select('email').lean();
    await declineRequest(requestId, userId, actor?.email ?? '');
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return serializeWorkspace(workspace);
  }

  const invite = await getInviteForRecipient(workspaceId, requestId, userId);
  invite.status = 'declined';
  invite.respondedAt = new Date();
  await invite.save();

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  return serializeWorkspace(workspace);
};

export const getWorkspaceChatHistory = async (workspaceId: string, userId: string, before?: string, limit = 50) => {
  const workspace = await getWorkspaceForChatAccess(workspaceId, userId);
  const filter: Record<string, unknown> = { workspaceId };
  if (before) {
    filter._id = { $lt: before };
  }
  const messages = await ChatMessage.find(filter).sort({ sentAt: -1 }).limit(limit).lean();
  const uploads = workspace.uploads || [];
  const messagesWithStorageMetadata = messages.map((message) => {
    if (message.attachmentStorageProvider && message.attachmentStorageKey) {
      return message;
    }

    const upload = uploads.find((item) => {
      const sameUrl = message.attachmentUrl && item.fileUrl === message.attachmentUrl;
      const sameFile =
        message.attachmentName &&
        item.fileName === message.attachmentName &&
        item.fileSizeBytes === message.attachmentSizeBytes &&
        item.fileType === message.attachmentType;

      return sameUrl || sameFile;
    });

    if (!upload?.storageProvider || !upload.storageKey) {
      return message;
    }

    return {
      ...message,
      attachmentUploadId: upload._id,
      attachmentStorageProvider: upload.storageProvider,
      attachmentStorageKey: upload.storageKey,
      attachmentMimeType: message.attachmentMimeType ?? upload.mimeType,
    };
  });

  return Promise.all(messagesWithStorageMetadata.map((message) => serializeChatMessage(message)));
};

export const addChatParticipant = async (
  workspaceId: string,
  ownerId: string,
  payload: z.infer<typeof addChatParticipantSchema>,
) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);

  let user = payload.userId ? await User.findById(payload.userId) : null;
  if (!user && payload.email) {
    user = await User.findOne({ email: payload.email.toLowerCase() });
  }

  if (!user || !user.isActive) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.role !== payload.role) {
    throw new ApiError(400, 'ROLE_MISMATCH', `User's role is '${user.role}', but '${payload.role}' was specified.`);
  }

  if (
    payload.role === 'mentor' &&
    !ASSIGNABLE_MENTOR_APPROVAL_STATUSES.has(user.adminApprovalStatus ?? 'pending')
  ) {
    throw new ApiError(400, 'MENTOR_NOT_AVAILABLE', 'Only approved mentors can be assigned to a project');
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

  await createRequest({
    type: 'workspace_chat_access',
    actionType: 'access_chat',
    fromUserId: ownerId,
    toUserId: String(user._id),
    targetEntityType: 'workspace',
    targetEntityId: workspaceId,
    targetEntityTitle: workspace.title,
    targetRole: payload.role,
    requestedRole: payload.role,
    requestedPermission: 'workspace_chat_access',
    message:
      payload.role === 'mentor'
        ? `Project mentor access to ${workspace.title}`
        : `Investor chat access to ${workspace.title}`,
    deepLink: `/product-workspace/${workspaceId}`,
    acceptRedirect: `/product-workspace/${workspaceId}`,
    metadata: {
      workspaceId,
      targetName: workspace.title,
      workspaceTitle: workspace.title,
      accessScope: 'chat',
      participantRole: payload.role,
    },
  });

  return serializeWorkspace(workspace);
};

export const removeChatParticipant = async (
  workspaceId: string,
  ownerId: string,
  participantUserId: string,
) => {
  const workspace = await getWorkspaceForOwner(workspaceId, ownerId);
  const studentIds = getWorkspaceStudentIds(workspace);
  const participant = workspace.chatParticipants.find((p) => String(p.userId) === participantUserId);
  if (!participant) {
    throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Chat participant not found');
  }

  workspace.chatParticipants = workspace.chatParticipants.filter(
    (p) => String(p.userId) !== participantUserId,
  );
  await workspace.save();

  if (participant.role === 'mentor') {
    await Promise.all([
      removeMentorWatchersForWorkspace(participantUserId, workspaceId, studentIds),
      NotificationService.create({
        userId: participantUserId,
        type: 'system',
        title: 'Project mentor access removed',
        body: `A student team removed your mentor access from "${workspace.title}".`,
        link: '/dashboard/mentor',
      }),
    ]);
  }

  return serializeWorkspace(workspace);
};

const grantWorkspaceMemberRequest = async (requestId: string, workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === String(userId));
  if (!isMember) {
    if (workspace.teamMemberIds.length >= 5) {
      throw new ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
    }

    workspace.teamMemberIds.push(objectId(userId));
    await workspace.save();
  }

  const request = await RequestRecord.findById(requestId).select('metadata').lean();
  const teamRequestId =
    typeof request?.metadata?.teamRequestId === 'string' ? request.metadata.teamRequestId : undefined;
  if (teamRequestId) {
    await TeamRequest.updateOne(
      { _id: teamRequestId },
      {
        $set: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      },
    );
  }
};

const validateWorkspaceMemberRequest = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId).select('teamMemberIds isActive');
  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isMember = workspace.teamMemberIds.some((memberId) => String(memberId) === String(userId));
  if (!isMember && workspace.teamMemberIds.length >= 5) {
    throw new ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
  }
};

const grantWorkspaceChatRequest = async (workspaceId: string, userId: string) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const user = await User.findById(userId).select('_id role').lean();
  if (!user || !['mentor', 'investor'].includes(user.role)) {
    throw new ApiError(400, 'ROLE_MISMATCH', 'Only mentors or investors can accept chat access.');
  }

  const alreadyParticipant = workspace.chatParticipants.some((p) => String(p.userId) === userId);
  const alreadyMember = workspace.teamMemberIds.some((id) => String(id) === userId);
  if (!alreadyParticipant && !alreadyMember) {
    workspace.chatParticipants.push({
      _id: new Types.ObjectId(),
      userId: user._id,
      role: user.role as 'mentor' | 'investor',
      addedBy: objectId(String(workspace.ownerId)),
      addedAt: new Date(),
    });
    await workspace.save();
  }

  if (user.role === 'mentor') {
    const studentIds = getWorkspaceStudentIds(workspace);
    const workspacePath = `/product-workspace/${workspaceId}`;

    await Promise.all([
      addMentorWatchers(userId, studentIds),
      ...studentIds.map((studentId) =>
        NotificationService.create({
          userId: studentId,
          type: 'system',
          title: 'Mentor joined your project',
          body: `${workspace.title} now has an active project mentor.`,
          link: workspacePath,
        }),
      ),
    ]);
  }
};

const validateWorkspaceChatRequest = async (workspaceId: string, userId: string) => {
  const [workspace, user] = await Promise.all([
    Workspace.findById(workspaceId).select('isActive').lean(),
    User.findById(userId).select('_id role isActive adminApprovalStatus').lean(),
  ]);

  if (!workspace || !workspace.isActive) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  if (!user || !user.isActive || !['mentor', 'investor'].includes(user.role)) {
    throw new ApiError(400, 'ROLE_MISMATCH', 'Only mentors or investors can accept chat access.');
  }

  if (user.role === 'mentor' && !ASSIGNABLE_MENTOR_APPROVAL_STATUSES.has(user.adminApprovalStatus ?? 'pending')) {
    throw new ApiError(400, 'MENTOR_NOT_AVAILABLE', 'Only approved mentors can accept project mentor access.');
  }
};

registerRequestHandler('workspace_member', {
  validateAccept: async (request, actorUserId) => {
    if (request.targetEntityType !== 'workspace') {
      return;
    }
    await validateWorkspaceMemberRequest(request.targetEntityId, actorUserId);
  },
  onAccept: async (request, actorUserId) => {
    if (request.targetEntityType !== 'workspace') {
      return;
    }
    await grantWorkspaceMemberRequest(String(request._id), request.targetEntityId, actorUserId);
  },
  onDecline: async (request) => {
    const teamRequestId =
      typeof request.metadata?.teamRequestId === 'string' ? request.metadata.teamRequestId : undefined;
    if (teamRequestId) {
      await TeamRequest.updateOne(
        { _id: teamRequestId },
        {
          $set: {
            status: 'declined',
            respondedAt: new Date(),
          },
        },
      );
    }
  },
});

registerRequestHandler('workspace_chat_access', {
  validateAccept: async (request, actorUserId) => {
    if (request.targetEntityType !== 'workspace') {
      return;
    }
    await validateWorkspaceChatRequest(request.targetEntityId, actorUserId);
  },
  onAccept: async (request, actorUserId) => {
    if (request.targetEntityType !== 'workspace') {
      return;
    }
    await grantWorkspaceChatRequest(request.targetEntityId, actorUserId);
  },
});

registerRequestHandler('generic', {
  validateAccept: async (request, actorUserId) => {
    if (request.actionType !== 'invest' || request.requestedPermission !== 'dm_investor') {
      return;
    }

    const workspaceId = typeof request.metadata?.workspaceId === 'string' ? request.metadata.workspaceId : '';
    if (!workspaceId) {
      return;
    }

    await validateWorkspaceChatRequest(workspaceId, actorUserId);
  },
  onAccept: async (request, actorUserId) => {
    if (request.actionType !== 'invest' || request.requestedPermission !== 'dm_investor') {
      return;
    }

    const workspaceId = typeof request.metadata?.workspaceId === 'string' ? request.metadata.workspaceId : '';
    if (!workspaceId) {
      return;
    }

    await grantWorkspaceChatRequest(workspaceId, actorUserId);
  },
});
