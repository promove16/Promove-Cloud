import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { getWorkspaceChatHistory } from '../workspace/workspace.service';

export const getChatHistory = async (req: Request, res: Response) => {
  const workspaceId = Array.isArray(req.params.workspaceId)
    ? req.params.workspaceId[0]
    : req.params.workspaceId;
  if (!workspaceId) {
    throw new ApiError(400, 'WORKSPACE_REQUIRED', 'Workspace id is required');
  }
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  const limit = Number(req.query.limit ?? 50);
  const messages = await getWorkspaceChatHistory(workspaceId, req.user!._id, before, limit);
  res.json(new ApiResponse(messages));
};
