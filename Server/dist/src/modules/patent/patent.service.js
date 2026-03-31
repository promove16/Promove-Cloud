"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPatents = exports.submitPatent = exports.patentSubmissionSchema = void 0;
const zod_1 = require("zod");
const bullmq_1 = require("../../config/bullmq");
const scoreEngine_1 = require("../../services/scoreEngine");
const ApiError_1 = require("../../utils/ApiError");
const user_model_1 = require("../user/user.model");
const roles_types_1 = require("../../types/roles.types");
const workspace_model_1 = require("../workspace/workspace.model");
const patent_model_1 = require("./patent.model");
const filingDocumentsSchema = zod_1.z
    .object({
    inventionCategory: zod_1.z.enum([
        'mobile_app_backend',
        'iot_hardware_interface',
        'mechanical_improvement',
        'software_hardware_integration',
        'other',
    ]),
    specificationType: zod_1.z.enum(['provisional', 'complete']),
    inventorJournalSummary: zod_1.z.string().trim().min(50),
    priorArtSearchSummary: zod_1.z.string().trim().min(50),
    prototypeStatus: zod_1.z.enum([
        'concept_only',
        'partial_prototype',
        'working_prototype',
        'validated_prototype',
    ]),
    specificationDraft: zod_1.z.string().trim().min(80),
    abstractDraft: zod_1.z.string().trim().min(30),
    claimsDraft: zod_1.z.string().trim().min(50),
    drawingsPrepared: zod_1.z.boolean(),
    drawingsNotes: zod_1.z.string().trim().min(20),
    form1ApplicantDetailsConfirmed: zod_1.z.literal(true),
    form3ForeignFilingDetails: zod_1.z.string().trim().max(500).optional(),
    form5InventorshipConfirmed: zod_1.z.literal(true),
    form26PowerOfAttorneyRequired: zod_1.z.boolean(),
    form26PowerOfAttorneyDetails: zod_1.z.string().trim().max(500).optional(),
    examinationRequestPlan: zod_1.z.string().trim().min(30),
    publicDisclosureChecked: zod_1.z.literal(true),
    professionalSupportNeeded: zod_1.z.boolean(),
    costManagementNotes: zod_1.z.string().trim().max(500).optional(),
})
    .superRefine((value, ctx) => {
    if (value.form26PowerOfAttorneyRequired && !value.form26PowerOfAttorneyDetails?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['form26PowerOfAttorneyDetails'],
            message: 'Add Form 26 details if a patent agent or attorney will be used.',
        });
    }
});
const PATENT_DOC_CATEGORIES = [
    'inventor_journal',
    'prior_art_search',
    'specification_draft',
    'abstract_draft',
    'claims_draft',
    'drawings_diagrams',
    'examination_request',
    'form3_foreign_filing',
    'cost_management',
];
exports.patentSubmissionSchema = zod_1.z.object({
    projectTitle: zod_1.z.string().trim().min(2).max(200),
    workspaceId: zod_1.z.string().min(1),
    documentUploads: zod_1.z
        .array(zod_1.z.object({
        uploadId: zod_1.z.string().min(1),
        category: zod_1.z.enum(PATENT_DOC_CATEGORIES),
    }))
        .min(1)
        .max(9),
    questionnaire: zod_1.z.object({
        whatIsYourInnovation: zod_1.z.string().trim().min(50),
        noveltyExplanation: zod_1.z.string().trim().min(50),
        technicalDetails: zod_1.z.string().trim().min(50),
        marketUseCase: zod_1.z.string().trim().min(50),
        priorArtAwareness: zod_1.z.string().trim().min(50),
    }),
    filingDocuments: filingDocumentsSchema,
});
const submitPatent = async (userId, payload) => {
    const workspace = await workspace_model_1.Workspace.findOne({
        _id: payload.workspaceId,
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
    }).lean();
    if (!workspace) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace before submitting for patent review.');
    }
    const supportingDocuments = payload.documentUploads.map((item) => {
        const upload = workspace.uploads.find((u) => String(u._id) === item.uploadId);
        if (!upload) {
            throw new ApiError_1.ApiError(400, 'SUPPORTING_DOCUMENT_NOT_FOUND', 'One or more selected project documents no longer exist in the workspace.');
        }
        return {
            uploadId: upload._id,
            fileUrl: upload.fileUrl,
            fileType: upload.fileType,
            fileName: upload.fileName,
            fileSizeBytes: upload.fileSizeBytes,
            documentCategory: item.category,
            ...(upload.note ? { note: upload.note } : {}),
        };
    });
    const patent = await patent_model_1.Patent.create({
        studentId: userId,
        workspaceId: payload.workspaceId,
        projectTitle: payload.projectTitle,
        questionnaire: payload.questionnaire,
        filingDocuments: payload.filingDocuments,
        supportingDocuments,
        status: 'submitted',
        submittedAt: new Date(),
    });
    await (0, scoreEngine_1.applyScoreAsync)({
        userId,
        trigger: 'PATENT_SUBMITTED',
        metadata: { patentId: String(patent._id) },
    });
    await bullmq_1.notificationQueue.add('patent-submitted', {
        userId,
        type: 'patent_status',
        title: 'Patent submission received',
        body: `Your patent submission for ${payload.projectTitle} is now in review.`,
        link: '/patent-support',
    });
    const admins = await user_model_1.User.find({ role: roles_types_1.UserRole.ADMIN }).select('_id').lean();
    await Promise.all(admins.map((admin) => bullmq_1.notificationQueue.add('patent-admin-notify', {
        userId: String(admin._id),
        type: 'patent_status',
        title: 'New patent submission',
        body: `${payload.projectTitle} has been submitted for patent review.`,
        link: '/admin/patents',
    })));
    return patent.toObject();
};
exports.submitPatent = submitPatent;
const getMyPatents = async (userId) => patent_model_1.Patent.find({ studentId: userId }).sort({ createdAt: -1 }).lean();
exports.getMyPatents = getMyPatents;
