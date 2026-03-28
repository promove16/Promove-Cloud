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

export const inviteMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
  })
  .refine((value) => value.email || value.userId, {
    message: 'Email or userId is required',
  });

const recalcProgressPercent = (workspace: { milestones: Array<{ completionPercent: number }> }) => {
  const total = workspace.milestones.reduce((sum, milestone) => sum + milestone.completionPercent, 0);
  return Math.round(total / workspace.milestones.length);
};

type WorkspaceSnapshot = {
  toObject?: () => WorkspaceSnapshot;
  ownerId: unknown;
  teamMemberIds: unknown[];
};

export const serializeWorkspace = async (workspace: WorkspaceSnapshot) => {
  const baseWorkspace: WorkspaceSnapshot =
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

  return {
    ...baseWorkspace,
    teamMembers: teamMembers.map((member) => ({
      _id: String(member._id),
      displayName: member.displayName,
      role: member.role,
      ...(member.avatar ? { avatar: member.avatar } : {}),
    })),
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
) => {
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
  const upload = await uploadToCloudinary(
    file.buffer,
    'promove/workspaces',
    fileType === 'pdf' ? 'raw' : 'image',
  );

  workspace.uploads.push({
    _id: new Types.ObjectId(),
    fileUrl: upload.secure_url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedBy: objectId(userId),
    uploadedAt: new Date(),
    note,
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
  await getWorkspaceForMember(workspaceId, userId);
  const filter: Record<string, unknown> = { workspaceId };
  if (before) {
    filter._id = { $lt: before };
  }
  return ChatMessage.find(filter).sort({ sentAt: -1 }).limit(limit).lean();
};
