"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Problem = void 0;
const mongoose_1 = require("mongoose");
const problemSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
        type: String,
        required: true,
        enum: ['Agriculture', 'Technology', 'Healthcare', 'Education', 'Environment', 'Rural Development', 'Other'],
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['Easy', 'Medium', 'Hard'],
    },
    domain: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    postedBy: { type: String, required: true, trim: true },
    claimedBy: { type: mongoose_1.Schema.Types.ObjectId, default: undefined, index: true },
    claimedAt: { type: Date, default: undefined },
}, { timestamps: true });
problemSchema.index({ category: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ isVerified: 1 });
problemSchema.index({ title: 'text', description: 'text' });
exports.Problem = (0, mongoose_1.model)('Problem', problemSchema);
