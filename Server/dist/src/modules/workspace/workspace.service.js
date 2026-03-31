"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeChatParticipant = exports.addChatParticipant = exports.getWorkspaceChatHistory = exports.removeMember = exports.inviteMember = exports.deleteTask = exports.updateTask = exports.addTask = exports.deleteCodeSubmission = exports.addCodeSubmission = exports.deleteRepoSubmission = exports.addRepoSubmission = exports.deleteWorkspaceUpload = exports.uploadWorkspaceFile = exports.addProgress = exports.deleteWorkspace = exports.updateWorkspace = exports.createWorkspace = exports.getWorkspaceForChatAccess = exports.getWorkspaceForOwner = exports.getWorkspaceForMember = exports.getAccessibleWorkspaces = exports.serializeWorkspace = exports.addChatParticipantSchema = exports.inviteMemberSchema = exports.addCodeSubmissionSchema = exports.addRepoSubmissionSchema = exports.addTaskSchema = exports.addProgressSchema = exports.updateWorkspaceSchema = exports.createWorkspaceSchema = void 0;
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const cloudinaryService_1 = require("../../services/cloudinaryService");
const emailService_1 = require("../../services/emailService");
const bullmq_1 = require("../../config/bullmq");
const scoreEngine_1 = require("../../services/scoreEngine");
const user_model_1 = require("../user/user.model");
const chat_model_1 = require("../chat/chat.model");
const workspace_model_1 = require("./workspace.model");
const ApiError_1 = require("../../utils/ApiError");
const objectId = (value) => new mongoose_1.Types.ObjectId(value);
exports.createWorkspaceSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(120),
    category: zod_1.z.string().trim().min(2).max(100),
    claimedProblemId: zod_1.z.string().optional(),
});
exports.updateWorkspaceSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(120).optional(),
    category: zod_1.z.string().trim().min(2).max(100).optional(),
    stage: zod_1.z.enum(['Ideation', 'Problem', 'Build', 'Patent', 'Launch']).optional(),
});
exports.addProgressSchema = zod_1.z.object({
    note: zod_1.z.string().trim().min(5).max(500),
    milestoneRef: zod_1.z.string().optional(),
    completionPercent: zod_1.z.number().min(0).max(100).optional(),
});
exports.addTaskSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(120),
    priority: zod_1.z.enum(['High', 'Medium', 'Low']),
    assignedTo: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().datetime().optional(),
});
exports.addRepoSubmissionSchema = zod_1.z.object({
    repoUrl: zod_1.z.string().trim().url().max(300),
    branch: zod_1.z.string().trim().max(120).optional(),
    commitHash: zod_1.z
        .string()
        .trim()
        .regex(/^[a-f0-9]{7,40}$/i, 'Commit hash must be 7 to 40 hex characters')
        .optional(),
    note: zod_1.z.string().trim().max(300).optional(),
});
exports.addCodeSubmissionSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(120),
    language: zod_1.z.string().trim().min(1).max(60),
    summary: zod_1.z.string().trim().max(300).optional(),
    codeSnippet: zod_1.z.string().trim().min(10).max(8000),
});
exports.inviteMemberSchema = zod_1.z
    .object({
    email: zod_1.z.string().email().optional(),
    userId: zod_1.z.string().optional(),
})
    .refine((value) => value.email || value.userId, {
    message: 'Email or userId is required',
});
exports.addChatParticipantSchema = zod_1.z
    .object({
    email: zod_1.z.string().email().optional(),
    userId: zod_1.z.string().optional(),
    role: zod_1.z.enum(['mentor', 'investor']),
})
    .refine((value) => value.email || value.userId, {
    message: 'Email or userId is required',
});
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
    { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, message: 'Private keys are not allowed in code submissions.' },
    { pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/, message: 'GitHub tokens are not allowed in code submissions.' },
    { pattern: /github_pat_[A-Za-z0-9_]{20,}/, message: 'GitHub personal access tokens are not allowed in code submissions.' },
    { pattern: /AKIA[0-9A-Z]{16}/, message: 'AWS access keys are not allowed in code submissions.' },
    { pattern: /AIza[0-9A-Za-z\-_]{35}/, message: 'Google API keys are not allowed in code submissions.' },
    { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/, message: 'Slack tokens are not allowed in code submissions.' },
    { pattern: /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^/\s@]+@/i, message: 'Database credentials are not allowed in code submissions.' },
];
const countLines = (value) => value.split(/\r\n|\r|\n/).length;
const assertCodeSubmissionIsSafe = (codeSnippet) => {
    for (const rule of HIGH_CONFIDENCE_SECRET_PATTERNS) {
        if (rule.pattern.test(codeSnippet)) {
            throw new ApiError_1.ApiError(400, 'SENSITIVE_CODE_BLOCKED', rule.message);
        }
    }
};
const normalizeGithubRepoUrl = (repoUrl) => {
    let parsed;
    try {
        parsed = new URL(repoUrl);
    }
    catch (_error) {
        throw new ApiError_1.ApiError(400, 'INVALID_REPOSITORY_URL', 'Enter a valid GitHub repository URL.');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!['github.com', 'www.github.com'].includes(hostname)) {
        throw new ApiError_1.ApiError(400, 'INVALID_REPOSITORY_URL', 'Only GitHub repository links are allowed.');
    }
    if (parsed.protocol !== 'https:') {
        throw new ApiError_1.ApiError(400, 'INVALID_REPOSITORY_URL', 'Repository links must use HTTPS.');
    }
    if (parsed.username || parsed.password) {
        throw new ApiError_1.ApiError(400, 'INVALID_REPOSITORY_URL', 'Repository links cannot include embedded credentials.');
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
        throw new ApiError_1.ApiError(400, 'INVALID_REPOSITORY_URL', 'Use a full GitHub repository URL like https://github.com/org/repo.');
    }
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    const normalized = `https://github.com/${owner}/${repo}`;
    return {
        repoUrl: normalized,
        displayName: `${owner}/${repo}`,
    };
};
const recalcProgressPercent = (workspace) => {
    const total = workspace.milestones.reduce((sum, milestone) => sum + milestone.completionPercent, 0);
    return Math.round(total / workspace.milestones.length);
};
const serializeWorkspace = async (workspace) => {
    const baseWorkspace = typeof workspace.toObject === 'function' ? workspace.toObject() : workspace;
    const memberIds = Array.from(new Set([
        String(baseWorkspace.ownerId),
        ...baseWorkspace.teamMemberIds.map((memberId) => String(memberId)),
    ]));
    const teamMembers = await user_model_1.User.find({ _id: { $in: memberIds } })
        .select('_id displayName role avatar')
        .lean();
    const chatParticipantUserIds = (baseWorkspace.chatParticipants || []).map((p) => String(p.userId));
    const chatParticipantUsers = chatParticipantUserIds.length > 0
        ? await user_model_1.User.find({ _id: { $in: chatParticipantUserIds } })
            .select('_id displayName role avatar')
            .lean()
        : [];
    const chatParticipantUserMap = new Map(chatParticipantUsers.map((u) => [String(u._id), u]));
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
        chatParticipants: (baseWorkspace.chatParticipants || []).map((p) => {
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
exports.serializeWorkspace = serializeWorkspace;
const getAccessibleWorkspaces = async (userId) => {
    const workspaces = await workspace_model_1.Workspace.find({
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
    })
        .sort({ updatedAt: -1 })
        .lean();
    return Promise.all(workspaces.map((workspace) => (0, exports.serializeWorkspace)(workspace)));
};
exports.getAccessibleWorkspaces = getAccessibleWorkspaces;
const getWorkspaceForMember = async (workspaceId, userId) => {
    const workspace = await workspace_model_1.Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    const memberIds = new Set([
        String(workspace.ownerId),
        ...workspace.teamMemberIds.map((memberId) => String(memberId)),
    ]);
    if (!memberIds.has(String(userId))) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return workspace;
};
exports.getWorkspaceForMember = getWorkspaceForMember;
const getWorkspaceForOwner = async (workspaceId, userId) => {
    const workspace = await workspace_model_1.Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only the workspace owner can do that.');
    }
    if (String(workspace.ownerId) !== String(userId)) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only the workspace owner can do that.');
    }
    return workspace;
};
exports.getWorkspaceForOwner = getWorkspaceForOwner;
const getWorkspaceForChatAccess = async (workspaceId, userId) => {
    const workspace = await workspace_model_1.Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    const isMember = String(workspace.ownerId) === String(userId) ||
        workspace.teamMemberIds.some((id) => String(id) === String(userId)) ||
        workspace.chatParticipants.some((p) => String(p.userId) === String(userId));
    if (!isMember) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return workspace;
};
exports.getWorkspaceForChatAccess = getWorkspaceForChatAccess;
const createWorkspace = async (userId, payload) => {
    const activeCount = await workspace_model_1.Workspace.countDocuments({ ownerId: userId, isActive: true });
    if (activeCount >= 3) {
        throw new ApiError_1.ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
    }
    const workspace = await workspace_model_1.Workspace.create({
        ownerId: userId,
        teamMemberIds: [userId],
        title: payload.title,
        category: payload.category,
        claimedProblemId: payload.claimedProblemId ? objectId(payload.claimedProblemId) : undefined,
        stage: payload.claimedProblemId ? 'Problem' : 'Ideation',
    });
    return (0, exports.serializeWorkspace)(workspace);
};
exports.createWorkspace = createWorkspace;
const updateWorkspace = async (workspaceId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    Object.assign(workspace, payload);
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.updateWorkspace = updateWorkspace;
const deleteWorkspace = async (workspaceId, userId) => {
    await (0, exports.getWorkspaceForOwner)(workspaceId, userId);
    await workspace_model_1.Workspace.findByIdAndDelete(workspaceId);
    await chat_model_1.ChatMessage.deleteMany({ workspaceId });
};
exports.deleteWorkspace = deleteWorkspace;
const addProgress = async (workspaceId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    workspace.progressUpdates.push({
        submittedBy: objectId(userId),
        note: payload.note,
        milestoneRef: payload.milestoneRef,
        submittedAt: new Date(),
        _id: new mongoose_1.Types.ObjectId(),
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
    await (0, scoreEngine_1.applyScoreAsync)({
        userId,
        trigger: 'PROGRESS_UPLOADED',
        metadata: { workspaceId, milestoneRef: payload.milestoneRef },
    });
    return (0, exports.serializeWorkspace)(workspace);
};
exports.addProgress = addProgress;
const uploadWorkspaceFile = async (workspaceId, userId, file, note, category) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const upload = await (0, cloudinaryService_1.uploadToCloudinary)(file.buffer, 'promove/workspaces', fileType === 'pdf' ? 'raw' : 'image');
    const allowedCategories = ['bug_report', 'error_log', 'screenshot', 'test_result', 'design_mockup', 'other'];
    const safeCategory = category && allowedCategories.includes(category) ? category : 'other';
    workspace.uploads.push({
        _id: new mongoose_1.Types.ObjectId(),
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
exports.uploadWorkspaceFile = uploadWorkspaceFile;
const deleteWorkspaceUpload = async (workspaceId, uploadId, userId) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const upload = workspace.uploads.find((item) => String(item._id) === uploadId);
    if (!upload) {
        throw new ApiError_1.ApiError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    }
    if (upload.cloudinaryPublicId) {
        await (0, cloudinaryService_1.deleteFromCloudinary)(upload.cloudinaryPublicId, upload.fileType === 'pdf' ? 'raw' : 'image');
    }
    workspace.uploads = workspace.uploads.filter((item) => String(item._id) !== uploadId);
    await workspace.save();
    return workspace.uploads;
};
exports.deleteWorkspaceUpload = deleteWorkspaceUpload;
const addRepoSubmission = async (workspaceId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const normalizedRepo = normalizeGithubRepoUrl(payload.repoUrl);
    if (workspace.repoSubmissions.length >= 10) {
        throw new ApiError_1.ApiError(400, 'REPO_SUBMISSION_LIMIT_REACHED', 'You cannot attach more repository links to this workspace.');
    }
    workspace.repoSubmissions.push({
        _id: new mongoose_1.Types.ObjectId(),
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
    return (0, exports.serializeWorkspace)(workspace);
};
exports.addRepoSubmission = addRepoSubmission;
const deleteRepoSubmission = async (workspaceId, repoId, userId) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const repo = workspace.repoSubmissions.find((item) => String(item._id) === repoId);
    if (!repo) {
        throw new ApiError_1.ApiError(404, 'REPOSITORY_NOT_FOUND', 'Repository submission not found');
    }
    workspace.repoSubmissions = workspace.repoSubmissions.filter((item) => String(item._id) !== repoId);
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.deleteRepoSubmission = deleteRepoSubmission;
const addCodeSubmission = async (workspaceId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    assertCodeSubmissionIsSafe(payload.codeSnippet);
    const lineCount = countLines(payload.codeSnippet);
    if (lineCount > 500) {
        throw new ApiError_1.ApiError(400, 'CODE_SUBMISSION_TOO_LARGE', 'Code submissions must be 500 lines or fewer.');
    }
    workspace.codeSubmissions.push({
        _id: new mongoose_1.Types.ObjectId(),
        title: payload.title,
        language: payload.language,
        summary: payload.summary,
        codeSnippet: payload.codeSnippet,
        lineCount,
        uploadedBy: objectId(userId),
        uploadedAt: new Date(),
    });
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.addCodeSubmission = addCodeSubmission;
const deleteCodeSubmission = async (workspaceId, codeId, userId) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const submission = workspace.codeSubmissions.find((item) => String(item._id) === codeId);
    if (!submission) {
        throw new ApiError_1.ApiError(404, 'CODE_SUBMISSION_NOT_FOUND', 'Code submission not found');
    }
    workspace.codeSubmissions = workspace.codeSubmissions.filter((item) => String(item._id) !== codeId);
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.deleteCodeSubmission = deleteCodeSubmission;
const addTask = async (workspaceId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    workspace.tasks.push({
        _id: new mongoose_1.Types.ObjectId(),
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
exports.addTask = addTask;
const updateTask = async (workspaceId, taskId, userId, payload) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const task = workspace.tasks.find((item) => String(item._id) === taskId);
    if (!task) {
        throw new ApiError_1.ApiError(404, 'TASK_NOT_FOUND', 'Task not found');
    }
    if (payload.title !== undefined)
        task.title = payload.title;
    if (payload.priority !== undefined)
        task.priority = payload.priority;
    if (payload.assignedTo !== undefined)
        task.assignedTo = payload.assignedTo ? objectId(payload.assignedTo) : undefined;
    if (payload.dueDate !== undefined)
        task.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
    if (payload.done !== undefined)
        task.done = payload.done;
    await workspace.save();
    return workspace.tasks;
};
exports.updateTask = updateTask;
const deleteTask = async (workspaceId, taskId, userId) => {
    const workspace = await (0, exports.getWorkspaceForMember)(workspaceId, userId);
    const task = workspace.tasks.find((item) => String(item._id) === taskId);
    if (!task) {
        throw new ApiError_1.ApiError(404, 'TASK_NOT_FOUND', 'Task not found');
    }
    workspace.tasks = workspace.tasks.filter((item) => String(item._id) !== taskId);
    await workspace.save();
    return workspace.tasks;
};
exports.deleteTask = deleteTask;
const inviteMember = async (workspaceId, ownerId, payload) => {
    const workspace = await (0, exports.getWorkspaceForOwner)(workspaceId, ownerId);
    if (workspace.teamMemberIds.length >= 5) {
        throw new ApiError_1.ApiError(400, 'TEAM_LIMIT_REACHED', 'A workspace can have at most 5 team members.');
    }
    let user = payload.userId ? await user_model_1.User.findById(payload.userId) : null;
    if (!user && payload.email) {
        user = await user_model_1.User.findOne({ email: payload.email.toLowerCase() });
    }
    if (user) {
        if (workspace.teamMemberIds.some((memberId) => String(memberId) === String(user?._id))) {
            throw new ApiError_1.ApiError(400, 'MEMBER_ALREADY_EXISTS', 'That member is already on the team.');
        }
        workspace.teamMemberIds.push(user._id);
        await workspace.save();
        await bullmq_1.notificationQueue.add('team-invite', {
            userId: String(user._id),
            type: 'team_invite',
            title: 'New workspace invite',
            body: `You were added to ${workspace.title}.`,
            link: `/product-workspace/${workspaceId}`,
        });
        return (0, exports.serializeWorkspace)(workspace);
    }
    if (!payload.email) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const inviter = await user_model_1.User.findById(ownerId).select('displayName').lean();
    await (0, emailService_1.sendTeamInviteEmail)({
        toEmail: payload.email,
        inviterName: inviter?.displayName ?? 'A ProMove collaborator',
        workspaceTitle: workspace.title,
        inviteLink: `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/signup`,
    });
    return (0, exports.serializeWorkspace)(workspace);
};
exports.inviteMember = inviteMember;
const removeMember = async (workspaceId, memberId, ownerId) => {
    const workspace = await (0, exports.getWorkspaceForOwner)(workspaceId, ownerId);
    workspace.teamMemberIds = workspace.teamMemberIds.filter((id) => String(id) !== memberId);
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.removeMember = removeMember;
const getWorkspaceChatHistory = async (workspaceId, userId, before, limit = 50) => {
    await (0, exports.getWorkspaceForChatAccess)(workspaceId, userId);
    const filter = { workspaceId };
    if (before) {
        filter._id = { $lt: before };
    }
    return chat_model_1.ChatMessage.find(filter).sort({ sentAt: -1 }).limit(limit).lean();
};
exports.getWorkspaceChatHistory = getWorkspaceChatHistory;
const addChatParticipant = async (workspaceId, ownerId, payload) => {
    const workspace = await (0, exports.getWorkspaceForOwner)(workspaceId, ownerId);
    let user = payload.userId ? await user_model_1.User.findById(payload.userId) : null;
    if (!user && payload.email) {
        user = await user_model_1.User.findOne({ email: payload.email.toLowerCase() });
    }
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (user.role !== payload.role && user.role !== 'mentor' && user.role !== 'investor') {
        throw new ApiError_1.ApiError(400, 'INVALID_ROLE', `Only users with role mentor or investor can be added as chat participants.`);
    }
    if (user.role !== payload.role) {
        throw new ApiError_1.ApiError(400, 'ROLE_MISMATCH', `User's role is '${user.role}', but '${payload.role}' was specified.`);
    }
    const alreadyParticipant = workspace.chatParticipants.some((p) => String(p.userId) === String(user._id));
    if (alreadyParticipant) {
        throw new ApiError_1.ApiError(400, 'PARTICIPANT_ALREADY_EXISTS', 'That user is already a chat participant.');
    }
    const alreadyMember = workspace.teamMemberIds.some((id) => String(id) === String(user._id));
    if (alreadyMember) {
        throw new ApiError_1.ApiError(400, 'MEMBER_ALREADY_EXISTS', 'That user is already a team member.');
    }
    workspace.chatParticipants.push({
        _id: new mongoose_1.Types.ObjectId(),
        userId: user._id,
        role: payload.role,
        addedBy: objectId(ownerId),
        addedAt: new Date(),
    });
    await workspace.save();
    await bullmq_1.notificationQueue.add('chat-participant-invite', {
        userId: String(user._id),
        type: 'chat_invite',
        title: 'You have been invited to a workspace chat',
        body: `You were granted chat access to ${workspace.title}.`,
        link: `/product-workspace/${workspaceId}`,
    });
    return (0, exports.serializeWorkspace)(workspace);
};
exports.addChatParticipant = addChatParticipant;
const removeChatParticipant = async (workspaceId, ownerId, participantUserId) => {
    const workspace = await (0, exports.getWorkspaceForOwner)(workspaceId, ownerId);
    const exists = workspace.chatParticipants.some((p) => String(p.userId) === participantUserId);
    if (!exists) {
        throw new ApiError_1.ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Chat participant not found');
    }
    workspace.chatParticipants = workspace.chatParticipants.filter((p) => String(p.userId) !== participantUserId);
    await workspace.save();
    return (0, exports.serializeWorkspace)(workspace);
};
exports.removeChatParticipant = removeChatParticipant;
