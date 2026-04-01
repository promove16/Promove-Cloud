"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Startup = void 0;
const mongoose_1 = require("mongoose");
const startupSchema = new mongoose_1.Schema({
    founderIds: { type: [mongoose_1.Schema.Types.ObjectId], required: true, default: [], index: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, default: undefined },
    name: { type: String, required: true, trim: true, default: '' },
    tagline: { type: String, required: true, trim: true, default: '' },
    category: { type: String, required: true, trim: true, default: '' },
    stage: {
        type: String,
        enum: ['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched'],
        default: 'Pre-Idea',
    },
    pitchDeckUrl: { type: String, default: undefined },
    pitchDeckName: { type: String, default: undefined },
    teamSize: { type: Number, default: 1 },
    fundingNeeded: { type: Number, default: undefined },
    activeProducts: { type: Number, default: 1 },
    launchedToInvestors: { type: Boolean, default: false },
    launchedToMentors: { type: Boolean, default: false },
    launchedToRecruiters: { type: Boolean, default: false },
    launchedAt: { type: Date, default: undefined },
    innovationScoreAtLaunch: { type: Number, default: 0 },
    totalShares: { type: Number, default: 1000, min: 1 },
    availableShares: { type: Number, default: 1000, min: 0 },
    reservedForSole: { type: Number, default: 510, min: 0 },
    maxPennyInvestors: { type: Number, default: 50, min: 1 },
    currentPennyCount: { type: Number, default: 0, min: 0 },
    hasSoleInvestor: { type: Boolean, default: false },
    soleInvestorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    traction: {
        patentFiled: { type: Boolean, default: false },
        mvpBuilt: { type: Boolean, default: false },
        revenueGenerating: { type: Boolean, default: false },
        usersCount: { type: Number, default: undefined },
    },
    reviewStatus: {
        type: String,
        enum: ['draft', 'review_requested', 'changes_requested', 'approved'],
        default: 'draft',
    },
    reviewRequestedAt: { type: Date, default: undefined },
    adminReviewedAt: { type: Date, default: undefined },
    adminReviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    adminNotes: { type: String, default: undefined },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
startupSchema.index({ launchedToInvestors: 1, innovationScoreAtLaunch: -1 });
startupSchema.index({ launchedToMentors: 1 });
startupSchema.index({ launchedToRecruiters: 1 });
startupSchema.index({ reviewStatus: 1, updatedAt: -1 });
exports.Startup = (0, mongoose_1.model)('Startup', startupSchema);
