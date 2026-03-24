"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreEvent = void 0;
const mongoose_1 = require("mongoose");
const scoreEventSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    trigger: {
        type: String,
        required: true,
    },
    delta: {
        type: Number,
        required: true,
    },
    scoreAfter: {
        type: Number,
        required: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
scoreEventSchema.index({ userId: 1, createdAt: -1 });
exports.ScoreEvent = (0, mongoose_1.model)('ScoreEvent', scoreEventSchema);
