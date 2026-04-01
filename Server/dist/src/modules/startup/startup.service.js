"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewStartupSubmission = exports.listStartupsForAdmin = exports.uploadPitchDeck = exports.launchStartup = exports.requestStartupReview = exports.updateStartupProfile = exports.getStartupForFounder = exports.getMyStartup = exports.createStartupProfile = exports.reviewStartupSubmissionSchema = exports.launchSchema = exports.startupSchema = void 0;
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const bullmq_1 = require("../../config/bullmq");
const cloudinaryService_1 = require("../../services/cloudinaryService");
const scoreEngine_1 = require("../../services/scoreEngine");
const user_model_1 = require("../user/user.model");
const startup_model_1 = require("./startup.model");
const ApiError_1 = require("../../utils/ApiError");
const placementRecord_model_1 = require("../college/placementRecord.model");
const roles_types_1 = require("../../types/roles.types");
const score_utils_1 = require("../innovationScore/score.utils");
const pdfFileNamePattern = /\.pdf$/i;
exports.startupSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
    name: zod_1.z.string().trim().min(0).max(120).default(''),
    tagline: zod_1.z.string().trim().min(0).max(200).default(''),
    category: zod_1.z.string().trim().min(0).max(100).default(''),
    stage: zod_1.z.enum(['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched']).default('Pre-Idea'),
    fundingNeeded: zod_1.z.number().optional(),
    activeProducts: zod_1.z.number().int().min(0).default(1),
    teamSize: zod_1.z.number().int().min(1).default(1),
    traction: zod_1.z
        .object({
        patentFiled: zod_1.z.boolean().default(false),
        mvpBuilt: zod_1.z.boolean().default(false),
        revenueGenerating: zod_1.z.boolean().default(false),
        usersCount: zod_1.z.number().int().min(0).optional(),
    })
        .default({
        patentFiled: false,
        mvpBuilt: false,
        revenueGenerating: false,
    }),
});
exports.launchSchema = zod_1.z.object({
    launchTo: zod_1.z.enum(['investors', 'mentors', 'both', 'recruiters']),
});
exports.reviewStartupSubmissionSchema = zod_1.z
    .object({
    decision: zod_1.z.enum(['approved', 'changes_requested']),
    adminNotes: zod_1.z.string().trim().max(1500).optional(),
})
    .superRefine((value, ctx) => {
    if (value.decision === 'changes_requested' && (!value.adminNotes || value.adminNotes.length < 10)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['adminNotes'],
            message: 'Admin notes are required when requesting changes.',
        });
    }
});
const clearReviewMetadata = (startup) => {
    startup.reviewRequestedAt = undefined;
    startup.adminReviewedAt = undefined;
    startup.adminReviewedBy = null;
    startup.adminNotes = undefined;
};
const isStartupProfileReady = (startup) => Boolean(startup.name && startup.tagline && startup.category && startup.founderIds.length > 0);
const createStartupProfile = async (userId, payload) => {
    const existing = await startup_model_1.Startup.findOne({ founderIds: userId, isActive: true });
    if (existing) {
        throw new ApiError_1.ApiError(400, 'STARTUP_EXISTS', 'You already have an active startup.');
    }
    const startup = await startup_model_1.Startup.create({
        founderIds: [userId],
        ...payload,
    });
    return startup.toObject();
};
exports.createStartupProfile = createStartupProfile;
const getMyStartup = async (userId) => startup_model_1.Startup.findOne({ founderIds: userId, isActive: true }).lean();
exports.getMyStartup = getMyStartup;
const getStartupForFounder = async (startupId, userId) => {
    const startup = await startup_model_1.Startup.findById(startupId);
    if (!startup) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
    }
    const isFounder = startup.founderIds.some((founderId) => String(founderId) === String(userId));
    if (!isFounder) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
    }
    return startup;
};
exports.getStartupForFounder = getStartupForFounder;
const updateStartupProfile = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    Object.assign(startup, payload);
    if (startup.reviewStatus === 'review_requested') {
        startup.reviewStatus = 'draft';
        clearReviewMetadata(startup);
    }
    await startup.save();
    return startup.toObject();
};
exports.updateStartupProfile = updateStartupProfile;
const requestStartupReview = async (startupId, userId) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    if (!isStartupProfileReady(startup)) {
        throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for review.');
    }
    if (startup.reviewStatus === 'approved') {
        throw new ApiError_1.ApiError(409, 'STARTUP_ALREADY_APPROVED', 'Startup has already been approved.');
    }
    if (startup.reviewStatus === 'review_requested') {
        throw new ApiError_1.ApiError(409, 'STARTUP_ALREADY_UNDER_REVIEW', 'Startup review is already pending.');
    }
    startup.reviewStatus = 'review_requested';
    startup.reviewRequestedAt = new Date();
    startup.adminReviewedAt = undefined;
    startup.adminReviewedBy = null;
    startup.adminNotes = undefined;
    await startup.save();
    return startup.toObject();
};
exports.requestStartupReview = requestStartupReview;
const launchStartup = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    if (!isStartupProfileReady(startup)) {
        throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for launch.');
    }
    if (payload.launchTo !== 'recruiters' && startup.reviewStatus !== 'approved') {
        throw new ApiError_1.ApiError(403, 'STARTUP_REVIEW_REQUIRED', 'Startup must be approved by admin before it can be launched to the marketplace.');
    }
    const user = await user_model_1.User.findById(userId).select('innovationScore').lean();
    const score = (0, score_utils_1.normalizeInnovationScore)(user?.innovationScore ?? 0);
    startup.launchedToInvestors = payload.launchTo === 'investors' || payload.launchTo === 'both';
    startup.launchedToMentors = payload.launchTo === 'mentors' || payload.launchTo === 'both';
    startup.launchedToRecruiters = payload.launchTo === 'recruiters';
    startup.launchedAt = new Date();
    startup.innovationScoreAtLaunch = score;
    if (payload.launchTo !== 'recruiters') {
        startup.stage = 'Launched';
    }
    await startup.save();
    if (payload.launchTo === 'recruiters') {
        const founder = await user_model_1.User.findByIdAndUpdate(userId, { discoverableToRecruiters: true }, { new: true })
            .select('innovationScore institutionId')
            .lean();
        if (founder?.institutionId) {
            const institution = await user_model_1.User.findById(founder.institutionId).select('role').lean();
            if (institution?.role === roles_types_1.UserRole.COLLEGE) {
                await placementRecord_model_1.PlacementRecord.findOneAndUpdate({
                    studentId: userId,
                    collegeId: founder.institutionId,
                    status: 'Discovered',
                }, {
                    studentId: userId,
                    collegeId: founder.institutionId,
                    status: 'Discovered',
                    innovationScoreAtTime: (0, score_utils_1.normalizeInnovationScore)(founder.innovationScore ?? 0),
                }, {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                });
            }
        }
    }
    else {
        await (0, scoreEngine_1.applyScoreAsync)({
            userId,
            trigger: 'STARTUP_LAUNCHED',
            metadata: { startupId, launchTo: payload.launchTo },
        });
    }
    const targetRoles = payload.launchTo === 'both'
        ? [roles_types_1.UserRole.INVESTOR, roles_types_1.UserRole.MENTOR]
        : payload.launchTo === 'investors'
            ? [roles_types_1.UserRole.INVESTOR]
            : payload.launchTo === 'mentors'
                ? [roles_types_1.UserRole.MENTOR]
                : [roles_types_1.UserRole.RECRUITER];
    const recipients = await user_model_1.User.find({ role: { $in: targetRoles }, isActive: true })
        .select('_id role')
        .lean();
    const getLaunchNotification = (recipientRole) => {
        if (recipientRole === roles_types_1.UserRole.INVESTOR) {
            return {
                type: 'startup_launch',
                title: 'New startup is seeking investors',
                body: `${startup.name} is seeking investors on ProMove.`,
                link: '/dashboard/investor/startups',
            };
        }
        if (recipientRole === roles_types_1.UserRole.MENTOR) {
            return {
                type: 'startup_launch',
                title: 'New startup in your area launched',
                body: `${startup.name} has launched and is looking for mentorship.`,
                link: '/dashboard/mentor/students',
            };
        }
        return {
            type: 'deal_interest',
            title: 'New startup launch',
            body: `${startup.name} is now live on ProMove.`,
            link: '/dashboard/recruiter',
        };
    };
    await Promise.all(recipients.map((recipient) => bullmq_1.notificationQueue.add('startup-launch', {
        userId: String(recipient._id),
        ...getLaunchNotification(recipient.role),
    })));
    return startup.toObject();
};
exports.launchStartup = launchStartup;
const uploadPitchDeck = async (startupId, userId, file) => {
    if (file.mimetype !== 'application/pdf' && !pdfFileNamePattern.test(file.originalname)) {
        throw new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
    }
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const uploaded = await (0, cloudinaryService_1.uploadToCloudinary)(file.buffer, 'promove/startups', 'raw', { format: 'pdf' });
    startup.pitchDeckUrl = uploaded.secure_url;
    startup.pitchDeckName = file.originalname;
    if (startup.reviewStatus === 'review_requested') {
        startup.reviewStatus = 'draft';
        clearReviewMetadata(startup);
    }
    await startup.save();
    return startup.toObject();
};
exports.uploadPitchDeck = uploadPitchDeck;
const listStartupsForAdmin = async (status) => {
    const query = status && status !== 'draft'
        ? { isActive: true, reviewStatus: status }
        : status
            ? { isActive: true, reviewStatus: status }
            : { isActive: true };
    const startups = await startup_model_1.Startup.find(query)
        .sort({ reviewRequestedAt: -1, updatedAt: -1, createdAt: -1 })
        .lean();
    const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
    const founders = founderIds.length > 0
        ? await user_model_1.User.find({ _id: { $in: founderIds } })
            .select('_id displayName avatar innovationScore domain')
            .lean()
        : [];
    const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
    return startups.map((startup) => ({
        _id: String(startup._id),
        name: startup.name,
        tagline: startup.tagline,
        category: startup.category,
        stage: startup.stage,
        fundingNeeded: startup.fundingNeeded,
        activeProducts: startup.activeProducts,
        teamSize: startup.teamSize,
        launchedToInvestors: startup.launchedToInvestors,
        launchedToMentors: startup.launchedToMentors,
        ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
        reviewStatus: startup.reviewStatus,
        ...(startup.reviewRequestedAt ? { reviewRequestedAt: startup.reviewRequestedAt.toISOString() } : {}),
        ...(startup.adminReviewedAt ? { adminReviewedAt: startup.adminReviewedAt.toISOString() } : {}),
        ...(startup.adminReviewedBy ? { adminReviewedBy: String(startup.adminReviewedBy) } : {}),
        ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
        ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
        ...(startup.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
        traction: startup.traction,
        founders: startup.founderIds
            .map((founderId) => founderMap.get(String(founderId)))
            .filter((founder) => Boolean(founder))
            .map((founder) => ({
            _id: String(founder._id),
            displayName: founder.displayName,
            ...(founder.avatar ? { avatar: founder.avatar } : {}),
            innovationScore: founder.innovationScore ?? 0,
            ...(founder.domain ? { domain: founder.domain } : {}),
        })),
        createdAt: startup.createdAt.toISOString(),
        updatedAt: startup.updatedAt.toISOString(),
    }));
};
exports.listStartupsForAdmin = listStartupsForAdmin;
const reviewStartupSubmission = async (adminId, startupId, payload) => {
    const startup = await startup_model_1.Startup.findById(startupId);
    if (!startup || !startup.isActive) {
        throw new ApiError_1.ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }
    startup.reviewStatus = payload.decision;
    startup.adminReviewedAt = new Date();
    startup.adminReviewedBy = new mongoose_1.Types.ObjectId(adminId);
    startup.adminNotes = payload.adminNotes?.trim() || undefined;
    if (payload.decision === 'approved') {
        startup.reviewRequestedAt = startup.reviewRequestedAt ?? new Date();
    }
    await startup.save();
    return startup.toObject();
};
exports.reviewStartupSubmission = reviewStartupSubmission;
