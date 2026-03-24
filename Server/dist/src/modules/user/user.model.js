"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const roles_types_1 = require("../../types/roles.types");
const scoreBreakdownSchema = new mongoose_1.Schema({
    problemsClaimed: { type: Number, default: 0 },
    skillsCompleted: { type: Number, default: 0 },
    progressUploads: { type: Number, default: 0 },
    patentsSubmitted: { type: Number, default: 0 },
    patentsApproved: { type: Number, default: 0 },
    mvpsVerified: { type: Number, default: 0 },
    marketReadyVerified: { type: Number, default: 0 },
    startupsLaunched: { type: Number, default: 0 },
    awardsApproved: { type: Number, default: 0 },
}, { _id: false });
const defaultScoreBreakdown = () => ({
    problemsClaimed: 0,
    skillsCompleted: 0,
    progressUploads: 0,
    patentsSubmitted: 0,
    patentsApproved: 0,
    mvpsVerified: 0,
    marketReadyVerified: 0,
    startupsLaunched: 0,
    awardsApproved: 0,
});
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
    role: {
        type: String,
        enum: roles_types_1.USER_ROLES,
        required: true,
    },
    displayName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    avatar: {
        type: String,
        default: undefined,
    },
    bio: {
        type: String,
        default: undefined,
        maxlength: 500,
    },
    domain: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 120,
    },
    profileComplete: {
        type: Boolean,
        default: false,
    },
    innovationScore: {
        type: Number,
        default: 0,
    },
    scoreBreakdown: {
        type: scoreBreakdownSchema,
        default: defaultScoreBreakdown,
    },
    accessGrantedBy: {
        type: String,
        enum: ['startup_school', 'instant_internship', 'skill_dev', 'iii', 'admin'],
        required: true,
    },
    accessExpiresAt: {
        type: Date,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLogin: {
        type: Date,
        default: undefined,
    },
    discoverableToRecruiters: {
        type: Boolean,
        default: false,
    },
    institutionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: undefined,
    },
}, {
    timestamps: true,
});
userSchema.index({ role: 1, innovationScore: -1 });
userSchema.index({ institutionId: 1 });
userSchema.index({ role: 1, isActive: 1 });
exports.User = (0, mongoose_1.model)('User', userSchema);
