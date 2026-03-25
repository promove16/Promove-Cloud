"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = void 0;
const mongoose_1 = require("mongoose");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const workspace_model_1 = require("../modules/workspace/workspace.model");
const chat_model_1 = require("../modules/chat/chat.model");
const initChatSocket = (io) => {
    const chat = io.of('/chat');
    chat.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token)
            return next(new Error('Unauthorized'));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
            socket.data.userId = decoded._id;
            socket.data.role = decoded.role;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    chat.on('connection', (socket) => {
        socket.on('chat:join', async ({ workspaceId }) => {
            if (!workspaceId || !mongoose_1.Types.ObjectId.isValid(workspaceId)) {
                socket.emit('chat:error', { message: 'Workspace not found' });
                return;
            }
            const hasAccess = await workspace_model_1.Workspace.exists({
                _id: workspaceId,
                $or: [{ ownerId: socket.data.userId }, { teamMemberIds: socket.data.userId }],
            });
            if (!hasAccess) {
                socket.emit('chat:error', { message: 'Workspace not found' });
                return;
            }
            socket.join(`ws:${workspaceId}`);
        });
        socket.on('chat:message', async ({ workspaceId, message, attachmentUrl }) => {
            const msg = await chat_model_1.ChatMessage.create({
                workspaceId,
                senderId: socket.data.userId,
                message,
                attachmentUrl,
            });
            chat.to(`ws:${workspaceId}`).emit('chat:message', msg);
        });
        socket.on('chat:leave', ({ workspaceId }) => {
            socket.leave(`ws:${workspaceId}`);
        });
    });
};
exports.initChatSocket = initChatSocket;
