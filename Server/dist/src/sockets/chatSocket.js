"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = void 0;
const workspace_model_1 = require("../modules/workspace/workspace.model");
const chat_model_1 = require("../modules/chat/chat.model");
const auth_1 = require("./auth");
const initChatSocket = (io) => {
    const chat = io.of('/chat');
    chat.use((socket, next) => {
        try {
            (0, auth_1.verifySocketToken)(socket);
            next();
        }
        catch (error) {
            next(error);
        }
    });
    chat.on('connection', (socket) => {
        socket.on('chat:join', async ({ workspaceId }) => {
            const workspace = await workspace_model_1.Workspace.findById(workspaceId).lean();
            if (!workspace)
                return;
            const isMember = String(workspace.ownerId) === socket.data.userId ||
                workspace.teamMemberIds.map(String).includes(socket.data.userId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a workspace member' });
                return;
            }
            socket.join(`ws:${workspaceId}`);
        });
        socket.on('chat:message', async ({ workspaceId, message, attachmentUrl, attachmentType }) => {
            const workspace = await workspace_model_1.Workspace.findById(workspaceId).lean();
            if (!workspace)
                return;
            const isMember = String(workspace.ownerId) === socket.data.userId ||
                workspace.teamMemberIds.map(String).includes(socket.data.userId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a workspace member' });
                return;
            }
            const saved = await chat_model_1.ChatMessage.create({
                workspaceId,
                senderId: socket.data.userId,
                message,
                attachmentUrl,
                attachmentType,
                sentAt: new Date(),
            });
            chat.to(`ws:${workspaceId}`).emit('chat:message', saved.toObject());
        });
        socket.on('chat:leave', ({ workspaceId }) => {
            socket.leave(`ws:${workspaceId}`);
        });
    });
};
exports.initChatSocket = initChatSocket;
