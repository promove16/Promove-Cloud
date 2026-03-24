"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPitchDeck = exports.launchStartup = exports.updateStartupProfile = exports.getStartupForFounder = exports.getMyStartup = exports.createStartupProfile = exports.launchSchema = exports.startupSchema = void 0;
const zod_1 = require("zod");
const bullmq_1 = require("../../config/bullmq");
const cloudinaryService_1 = require("../../services/cloudinaryService");
const scoreEngine_1 = require("../../services/scoreEngine");
const user_model_1 = require("../user/user.model");
const startup_model_1 = require("./startup.model");
const ApiError_1 = require("../../utils/ApiError");
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
    const startup = await startup_model_1.Startup.findOne({ _id: startupId, founderIds: userId });
    if (!startup) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
    }
    return startup;
};
exports.getStartupForFounder = getStartupForFounder;
const updateStartupProfile = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    Object.assign(startup, payload);
    await startup.save();
    return startup.toObject();
};
exports.updateStartupProfile = updateStartupProfile;
const launchStartup = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    if (!startup.name || !startup.tagline || !startup.category || startup.founderIds.length === 0) {
        throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for launch.');
    }
    const user = await user_model_1.User.findById(userId).select('innovationScore').lean();
    const score = user?.innovationScore ?? 0;
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
        await user_model_1.User.findByIdAndUpdate(userId, { discoverableToRecruiters: true });
    }
    else {
        await (0, scoreEngine_1.applyScoreAsync)({
            userId,
            trigger: 'STARTUP_LAUNCHED',
            metadata: { startupId, launchTo: payload.launchTo },
        });
    }
    const targetRoles = payload.launchTo === 'both'
        ? ['investor', 'mentor']
        : payload.launchTo === 'investors'
            ? ['investor']
            : payload.launchTo === 'mentors'
                ? ['mentor']
                : ['recruiter'];
    const recipients = await user_model_1.User.find({ role: { $in: targetRoles }, isActive: true }).select('_id').lean();
    await Promise.all(recipients.map((recipient) => bullmq_1.notificationQueue.add('startup-launch', {
        userId: String(recipient._id),
        type: payload.launchTo === 'recruiters' ? 'deal_interest' : 'startup_launch',
        title: 'New startup launch',
        body: `${startup.name} is now live on ProMove.`,
        link: '/startup-launch',
    })));
    return startup.toObject();
};
exports.launchStartup = launchStartup;
const uploadPitchDeck = async (startupId, userId, file) => {
    if (file.mimetype !== 'application/pdf') {
        throw new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
    }
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const uploaded = await (0, cloudinaryService_1.uploadToCloudinary)(file.buffer, 'promove/startups', 'raw');
    startup.pitchDeckUrl = uploaded.secure_url;
    await startup.save();
    return startup.toObject();
};
exports.uploadPitchDeck = uploadPitchDeck;
