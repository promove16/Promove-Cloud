"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = void 0;
const mongoose_1 = require("mongoose");
const chatMessageSchema = new mongoose_1.Schema({
    workspaceId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: { type: String, enum: ['pdf', 'image'], default: undefined },
    sentAt: { type: Date, default: () => new Date() },
}, { timestamps: false });
chatMessageSchema.index({ workspaceId: 1, sentAt: -1 });
exports.ChatMessage = (0, mongoose_1.model)('ChatMessage', chatMessageSchema);
