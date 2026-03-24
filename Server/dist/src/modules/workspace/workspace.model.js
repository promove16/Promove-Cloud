"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const mongoose_1 = require("mongoose");
const milestoneNames = [
    'Research & Planning',
    'Design & Prototyping',
    'Development',
    'Testing & Validation',
    'Final Delivery',
];
const workspaceSchema = new mongoose_1.Schema({
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    teamMemberIds: { type: [mongoose_1.Schema.Types.ObjectId], required: true, default: [] },
    claimedProblemId: { type: mongoose_1.Schema.Types.ObjectId, default: undefined, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    stage: {
        type: String,
        required: true,
        enum: ['Ideation', 'Problem', 'Build', 'Patent', 'Launch'],
        default: 'Problem',
    },
    progressPercent: { type: Number, default: 0 },
    milestones: {
        type: [
            new mongoose_1.Schema({
                name: { type: String, enum: milestoneNames, required: true },
                isCompleted: { type: Boolean, default: false },
                completedAt: { type: Date, default: undefined },
                completedBy: { type: mongoose_1.Schema.Types.ObjectId, default: undefined },
                completionPercent: { type: Number, default: 0 },
            }, { _id: true }),
        ],
        default: () => milestoneNames.map((name) => ({
            name,
            isCompleted: false,
            completionPercent: 0,
        })),
    },
    tasks: {
        type: [
            new mongoose_1.Schema({
                title: { type: String, required: true, trim: true },
                priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
                assignedTo: { type: mongoose_1.Schema.Types.ObjectId, default: undefined },
                dueDate: { type: Date, default: undefined },
                done: { type: Boolean, default: false },
                createdAt: { type: Date, default: () => new Date() },
            }, { _id: true }),
        ],
        default: [],
    },
    uploads: {
        type: [
            new mongoose_1.Schema({
                fileUrl: { type: String, required: true },
                fileType: { type: String, enum: ['pdf', 'image'], required: true },
                fileName: { type: String, required: true },
                fileSizeBytes: { type: Number, required: true },
                uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, required: true },
                uploadedAt: { type: Date, default: () => new Date() },
                note: { type: String, default: undefined },
                cloudinaryPublicId: { type: String, default: undefined },
            }, { _id: true }),
        ],
        default: [],
    },
    progressUpdates: {
        type: [
            new mongoose_1.Schema({
                submittedBy: { type: mongoose_1.Schema.Types.ObjectId, required: true },
                note: { type: String, required: true, trim: true },
                milestoneRef: { type: String, default: undefined },
                submittedAt: { type: Date, default: () => new Date() },
            }, { _id: true }),
        ],
        default: [],
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
workspaceSchema.index({ teamMemberIds: 1 });
exports.Workspace = (0, mongoose_1.model)('Workspace', workspaceSchema);
