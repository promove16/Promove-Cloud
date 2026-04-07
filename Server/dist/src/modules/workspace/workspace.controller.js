"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeWorkspaceChatParticipant = exports.addWorkspaceChatParticipant = exports.getWorkspaceChat = exports.removeWorkspaceMember = exports.declineWorkspaceInvite = exports.acceptWorkspaceInvite = exports.inviteWorkspaceMember = exports.removeWorkspaceTask = exports.patchWorkspaceTask = exports.addWorkspaceTask = exports.removeWorkspaceCodeSubmission = exports.addWorkspaceCodeSubmission = exports.removeWorkspaceRepoSubmission = exports.addWorkspaceRepoSubmission = exports.removeWorkspaceAsset = exports.uploadWorkspaceAsset = exports.addWorkspaceProgress = exports.removeWorkspace = exports.patchWorkspace = exports.getWorkspace = exports.createWorkspaceController = exports.listWorkspaces = void 0;
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const workspace_service_1 = require("./workspace.service");
const ensureUserId = (req) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    return req.user._id;
};
const getParam = (value, code, message) => {
    const param = Array.isArray(value) ? value[0] : value;
    if (!param) {
        throw new ApiError_1.ApiError(400, code, message);
    }
    return param;
};
const listWorkspaces = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaces = await (0, workspace_service_1.getAccessibleWorkspaces)(userId);
    res.json(new ApiResponse_1.ApiResponse(workspaces));
};
exports.listWorkspaces = listWorkspaces;
const createWorkspaceController = async (req, res) => {
    const userId = ensureUserId(req);
    const workspace = await (0, workspace_service_1.createWorkspace)(userId, workspace_service_1.createWorkspaceSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.createWorkspaceController = createWorkspaceController;
const getWorkspace = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.getWorkspaceForMember)(workspaceId, userId);
    res.json(new ApiResponse_1.ApiResponse(await (0, workspace_service_1.serializeWorkspace)(workspace)));
};
exports.getWorkspace = getWorkspace;
const patchWorkspace = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.updateWorkspace)(workspaceId, userId, workspace_service_1.updateWorkspaceSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.patchWorkspace = patchWorkspace;
const removeWorkspace = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    await (0, workspace_service_1.deleteWorkspace)(workspaceId, userId);
    res.json(new ApiResponse_1.ApiResponse({ deleted: true }));
};
exports.removeWorkspace = removeWorkspace;
const addWorkspaceProgress = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.addProgress)(workspaceId, userId, workspace_service_1.addProgressSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.addWorkspaceProgress = addWorkspaceProgress;
const uploadWorkspaceAsset = async (req, res) => {
    const userId = ensureUserId(req);
    if (!req.file) {
        throw new ApiError_1.ApiError(400, 'FILE_REQUIRED', 'A file is required');
    }
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const uploads = await (0, workspace_service_1.uploadWorkspaceFile)(workspaceId, userId, req.file, req.body.note, req.body.category);
    res.json(new ApiResponse_1.ApiResponse(uploads));
};
exports.uploadWorkspaceAsset = uploadWorkspaceAsset;
const removeWorkspaceAsset = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const uploadId = getParam(req.params.uploadId, 'UPLOAD_REQUIRED', 'Upload id is required');
    const uploads = await (0, workspace_service_1.deleteWorkspaceUpload)(workspaceId, uploadId, userId);
    res.json(new ApiResponse_1.ApiResponse(uploads));
};
exports.removeWorkspaceAsset = removeWorkspaceAsset;
const addWorkspaceRepoSubmission = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.addRepoSubmission)(workspaceId, userId, workspace_service_1.addRepoSubmissionSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.addWorkspaceRepoSubmission = addWorkspaceRepoSubmission;
const removeWorkspaceRepoSubmission = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const repoId = getParam(req.params.repoId, 'REPOSITORY_REQUIRED', 'Repository id is required');
    const workspace = await (0, workspace_service_1.deleteRepoSubmission)(workspaceId, repoId, userId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.removeWorkspaceRepoSubmission = removeWorkspaceRepoSubmission;
const addWorkspaceCodeSubmission = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.addCodeSubmission)(workspaceId, userId, workspace_service_1.addCodeSubmissionSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.addWorkspaceCodeSubmission = addWorkspaceCodeSubmission;
const removeWorkspaceCodeSubmission = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const codeId = getParam(req.params.codeId, 'CODE_REQUIRED', 'Code submission id is required');
    const workspace = await (0, workspace_service_1.deleteCodeSubmission)(workspaceId, codeId, userId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.removeWorkspaceCodeSubmission = removeWorkspaceCodeSubmission;
const addWorkspaceTask = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const tasks = await (0, workspace_service_1.addTask)(workspaceId, userId, workspace_service_1.addTaskSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(tasks));
};
exports.addWorkspaceTask = addWorkspaceTask;
const patchWorkspaceTask = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const taskId = getParam(req.params.taskId, 'TASK_REQUIRED', 'Task id is required');
    const tasks = await (0, workspace_service_1.updateTask)(workspaceId, taskId, userId, req.body);
    res.json(new ApiResponse_1.ApiResponse(tasks));
};
exports.patchWorkspaceTask = patchWorkspaceTask;
const removeWorkspaceTask = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const taskId = getParam(req.params.taskId, 'TASK_REQUIRED', 'Task id is required');
    const tasks = await (0, workspace_service_1.deleteTask)(workspaceId, taskId, userId);
    res.json(new ApiResponse_1.ApiResponse(tasks));
};
exports.removeWorkspaceTask = removeWorkspaceTask;
const inviteWorkspaceMember = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.inviteMember)(workspaceId, userId, workspace_service_1.inviteMemberSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.inviteWorkspaceMember = inviteWorkspaceMember;
const acceptWorkspaceInvite = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const requestId = getParam(req.params.requestId, 'TEAM_INVITE_REQUIRED', 'Team invite id is required');
    const workspace = await (0, workspace_service_1.acceptMemberInvite)(workspaceId, requestId, userId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.acceptWorkspaceInvite = acceptWorkspaceInvite;
const declineWorkspaceInvite = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const requestId = getParam(req.params.requestId, 'TEAM_INVITE_REQUIRED', 'Team invite id is required');
    const workspace = await (0, workspace_service_1.declineMemberInvite)(workspaceId, requestId, userId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.declineWorkspaceInvite = declineWorkspaceInvite;
const removeWorkspaceMember = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const memberId = getParam(req.params.userId, 'MEMBER_REQUIRED', 'Member id is required');
    const workspace = await (0, workspace_service_1.removeMember)(workspaceId, memberId, userId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.removeWorkspaceMember = removeWorkspaceMember;
const getWorkspaceChat = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = Number(req.query.limit ?? 50);
    const messages = await (0, workspace_service_1.getWorkspaceChatHistory)(workspaceId, userId, before, limit);
    res.json(new ApiResponse_1.ApiResponse(messages));
};
exports.getWorkspaceChat = getWorkspaceChat;
const addWorkspaceChatParticipant = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const workspace = await (0, workspace_service_1.addChatParticipant)(workspaceId, userId, workspace_service_1.addChatParticipantSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.addWorkspaceChatParticipant = addWorkspaceChatParticipant;
const removeWorkspaceChatParticipant = async (req, res) => {
    const userId = ensureUserId(req);
    const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    const participantUserId = getParam(req.params.userId, 'PARTICIPANT_REQUIRED', 'Participant user id is required');
    const workspace = await (0, workspace_service_1.removeChatParticipant)(workspaceId, userId, participantUserId);
    res.json(new ApiResponse_1.ApiResponse(workspace));
};
exports.removeWorkspaceChatParticipant = removeWorkspaceChatParticipant;
