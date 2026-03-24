"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatHistory = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const ApiError_1 = require("../../utils/ApiError");
const workspace_service_1 = require("../workspace/workspace.service");
const getChatHistory = async (req, res) => {
    const workspaceId = Array.isArray(req.params.workspaceId)
        ? req.params.workspaceId[0]
        : req.params.workspaceId;
    if (!workspaceId) {
        throw new ApiError_1.ApiError(400, 'WORKSPACE_REQUIRED', 'Workspace id is required');
    }
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = Number(req.query.limit ?? 50);
    const messages = await (0, workspace_service_1.getWorkspaceChatHistory)(workspaceId, req.user._id, before, limit);
    res.json(new ApiResponse_1.ApiResponse(messages));
};
exports.getChatHistory = getChatHistory;
