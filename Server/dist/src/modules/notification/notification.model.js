"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const notificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['score_update', 'team_invite', 'patent_status', 'deal_interest', 'startup_launch', 'system'],
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    link: {
        type: String,
        default: undefined,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
exports.Notification = (0, mongoose_1.model)('Notification', notificationSchema);
