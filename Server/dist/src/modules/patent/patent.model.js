"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Patent = void 0;
const mongoose_1 = require("mongoose");
const patentSchema = new mongoose_1.Schema({
    studentId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: mongoose_1.Schema.Types.ObjectId, default: undefined },
    projectTitle: { type: String, required: true, trim: true },
    questionnaire: {
        whatIsYourInnovation: { type: String, required: true },
        noveltyExplanation: { type: String, required: true },
        technicalDetails: { type: String, required: true },
        marketUseCase: { type: String, required: true },
        priorArtAwareness: { type: String, required: true },
    },
    status: {
        type: String,
        enum: ['submitted', 'under_review', 'approved', 'rejected'],
        default: 'submitted',
    },
    submittedAt: { type: Date, default: () => new Date() },
    adminReviewedAt: { type: Date, default: undefined },
    adminReviewedBy: { type: mongoose_1.Schema.Types.ObjectId, default: undefined },
    adminNotes: { type: String, default: undefined },
    scoreAwarded: { type: Boolean, default: false },
}, { timestamps: true });
patentSchema.index({ studentId: 1, status: 1 });
exports.Patent = (0, mongoose_1.model)('Patent', patentSchema);
