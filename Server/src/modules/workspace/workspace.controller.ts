import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  addProgress,
  addProgressSchema,
  addTask,
  addTaskSchema,
  createWorkspace,
  createWorkspaceSchema,
  deleteTask,
  deleteWorkspace,
  deleteWorkspaceUpload,
  getAccessibleWorkspaces,
  getWorkspaceChatHistory,
  getWorkspaceForMember,
  serializeWorkspace,
  inviteMember,
  inviteMemberSchema,
  removeMember,
  updateTask,
  updateWorkspace,
  updateWorkspaceSchema,
  uploadWorkspaceFile,
} from './workspace.service';

const ensureUserId = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  return req.user._id;
};

const getParam = (value: string | string[] | undefined, code: string, message: string) => {
  const param = Array.isArray(value) ? value[0] : value;
  if (!param) {
    throw new ApiError(400, code, message);
  }
  return param;
};

export const listWorkspaces = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaces = await getAccessibleWorkspaces(userId);
  res.json(new ApiResponse(workspaces));
};

export const createWorkspaceController = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspace = await createWorkspace(userId, createWorkspaceSchema.parse(req.body));
  res.status(201).json(new ApiResponse(workspace));
};

export const getWorkspace = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const workspace = await getWorkspaceForMember(workspaceId, userId);
  res.json(new ApiResponse(await serializeWorkspace(workspace)));
};

export const patchWorkspace = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const workspace = await updateWorkspace(workspaceId, userId, updateWorkspaceSchema.parse(req.body));
  res.json(new ApiResponse(workspace));
};

export const removeWorkspace = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  await deleteWorkspace(workspaceId, userId);
  res.json(new ApiResponse({ deleted: true }));
};

export const addWorkspaceProgress = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const workspace = await addProgress(workspaceId, userId, addProgressSchema.parse(req.body));
  res.json(new ApiResponse(workspace));
};

export const uploadWorkspaceAsset = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A file is required');
  }
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const uploads = await uploadWorkspaceFile(workspaceId, userId, req.file, req.body.note);
  res.json(new ApiResponse(uploads));
};

export const removeWorkspaceAsset = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const uploadId = getParam(req.params.uploadId, 'UPLOAD_REQUIRED', 'Upload id is required');
  const uploads = await deleteWorkspaceUpload(workspaceId, uploadId, userId);
  res.json(new ApiResponse(uploads));
};

export const addWorkspaceTask = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const tasks = await addTask(workspaceId, userId, addTaskSchema.parse(req.body));
  res.status(201).json(new ApiResponse(tasks));
};

export const patchWorkspaceTask = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const taskId = getParam(req.params.taskId, 'TASK_REQUIRED', 'Task id is required');
  const tasks = await updateTask(workspaceId, taskId, userId, req.body);
  res.json(new ApiResponse(tasks));
};

export const removeWorkspaceTask = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const taskId = getParam(req.params.taskId, 'TASK_REQUIRED', 'Task id is required');
  const tasks = await deleteTask(workspaceId, taskId, userId);
  res.json(new ApiResponse(tasks));
};

export const inviteWorkspaceMember = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const workspace = await inviteMember(workspaceId, userId, inviteMemberSchema.parse(req.body));
  res.json(new ApiResponse(workspace));
};

export const removeWorkspaceMember = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const memberId = getParam(req.params.userId, 'MEMBER_REQUIRED', 'Member id is required');
  const workspace = await removeMember(workspaceId, memberId, userId);
  res.json(new ApiResponse(workspace));
};

export const getWorkspaceChat = async (req: Request, res: Response) => {
  const userId = ensureUserId(req);
  const workspaceId = getParam(req.params.id, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  const limit = Number(req.query.limit ?? 50);
  const messages = await getWorkspaceChatHistory(workspaceId, userId, before, limit);
  res.json(new ApiResponse(messages));
};
