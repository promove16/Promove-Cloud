"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPatents = exports.submitPatent = exports.patentSubmissionSchema = void 0;
const zod_1 = require("zod");
const bullmq_1 = require("../../config/bullmq");
const scoreEngine_1 = require("../../services/scoreEngine");
const patent_model_1 = require("./patent.model");
exports.patentSubmissionSchema = zod_1.z.object({
    projectTitle: zod_1.z.string().trim().min(2).max(200),
    workspaceId: zod_1.z.string().optional(),
    questionnaire: zod_1.z.object({
        whatIsYourInnovation: zod_1.z.string().trim().min(50),
        noveltyExplanation: zod_1.z.string().trim().min(50),
        technicalDetails: zod_1.z.string().trim().min(50),
        marketUseCase: zod_1.z.string().trim().min(50),
        priorArtAwareness: zod_1.z.string().trim().min(50),
    }),
});
const submitPatent = async (userId, payload) => {
    const patent = await patent_model_1.Patent.create({
        studentId: userId,
        workspaceId: payload.workspaceId,
        projectTitle: payload.projectTitle,
        questionnaire: payload.questionnaire,
        status: 'submitted',
        submittedAt: new Date(),
    });
    await (0, scoreEngine_1.applyScoreAsync)({
        userId,
        trigger: 'PATENT_SUBMITTED',
        metadata: { patentId: String(patent._id) },
    });
    await bullmq_1.notificationQueue.add('patent-admin', {
        userId,
        type: 'patent_status',
        title: 'Patent submission received',
        body: `Your patent submission for ${payload.projectTitle} is now in review.`,
        link: '/patent-support',
    });
    return patent.toObject();
};
exports.submitPatent = submitPatent;
const getMyPatents = async (userId) => patent_model_1.Patent.find({ studentId: userId }).sort({ createdAt: -1 }).lean();
exports.getMyPatents = getMyPatents;
