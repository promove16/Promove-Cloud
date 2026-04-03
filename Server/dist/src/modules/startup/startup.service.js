"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewStartupSubmission = exports.listStartupsForAdmin = exports.demoteFromCoFounder = exports.promoteToCoFounder = exports.deleteStartupDocument = exports.uploadStartupDocument = exports.uploadPitchDeck = exports.launchStartup = exports.requestStartupReview = exports.updateStartupProfile = exports.getStartupForFounder = exports.getStartupById = exports.getMyStartups = exports.createStartupProfile = exports.startupDocumentUploadSchema = exports.reviewStartupSubmissionSchema = exports.launchSchema = exports.startupSchema = void 0;
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
const workspace_model_1 = require("../workspace/workspace.model");
const pdfFileNamePattern = /\.pdf$/i;
const STARTUP_DOCUMENT_CATEGORIES = [
    'business_plan',
    'incorporation_certificate',
    'moa',
    'aoa',
    'llp_agreement',
    'partnership_deed',
    'founder_agreement',
    'company_pan',
    'tan_allotment',
    'gst_registration',
    'registered_office_proof',
    'office_noc_or_utility_bill',
    'startup_india_certificate',
    'trademark_certificate',
    'patent_proof',
    'bank_account_proof',
    'regulatory_license',
    'prototype_documentation',
    'technical_documentation',
    'drawings_diagrams',
    'design_plan_sketch',
    'prior_art_search',
];
const startupDocumentCategorySchema = zod_1.z.enum(STARTUP_DOCUMENT_CATEGORIES);
const DEFAULT_BUSINESS_PROFILE = {
    problemStatement: '',
    solutionSummary: '',
    targetCustomers: '',
    marketAnalysis: '',
    revenueModel: '',
    goToMarketPlan: '',
};
const DEFAULT_REGISTRATION_PROFILE = {
    problemStatement: '',
    solutionDifferentiation: '',
    coreInnovation: '',
    priorArtStatus: '',
    workingMechanism: '',
    keyComponents: '',
    developmentStage: 'idea',
    documentationReadiness: '',
    inventorOwnership: 'individual',
    developmentContext: '',
    targetMarkets: '',
    commercializationStrategy: 'build_startup',
    publicDisclosureStatus: '',
    legalAgreements: '',
    ipProtectionType: 'patent',
};
const documentLabelMap = {
    business_plan: 'business plan or financial model',
    incorporation_certificate: 'certificate of incorporation',
    moa: 'Memorandum of Association (MOA)',
    aoa: 'Articles of Association (AOA)',
    llp_agreement: 'LLP agreement',
    partnership_deed: 'partnership deed',
    founder_agreement: 'founder agreement',
    company_pan: 'company PAN card',
    tan_allotment: 'TAN allotment proof',
    gst_registration: 'GST registration proof',
    registered_office_proof: 'registered office proof',
    office_noc_or_utility_bill: 'office NOC or utility bill',
    startup_india_certificate: 'Startup India recognition certificate',
    trademark_certificate: 'trademark certificate',
    patent_proof: 'patent proof',
    bank_account_proof: 'bank account proof',
    regulatory_license: 'regulatory license document',
    prototype_documentation: 'prototype documentation',
    technical_documentation: 'technical documentation',
    drawings_diagrams: 'drawings or diagrams',
    design_plan_sketch: 'design, plan, or pen-paper sketch',
    prior_art_search: 'prior art search notes',
};
const buildTextField = (max) => zod_1.z.string().trim().max(max).default('');
const startupBusinessProfileSchema = zod_1.z
    .object({
    problemStatement: buildTextField(2000),
    solutionSummary: buildTextField(2000),
    targetCustomers: buildTextField(1000),
    marketAnalysis: buildTextField(2000),
    revenueModel: buildTextField(1500),
    goToMarketPlan: buildTextField(1500),
})
    .default(DEFAULT_BUSINESS_PROFILE);
const startupRegistrationProfileSchema = zod_1.z
    .object({
    problemStatement: buildTextField(2500),
    solutionDifferentiation: buildTextField(2500),
    coreInnovation: buildTextField(2000),
    priorArtStatus: buildTextField(2000),
    workingMechanism: buildTextField(2500),
    keyComponents: buildTextField(2000),
    developmentStage: zod_1.z.enum(['idea', 'prototype', 'mvp', 'market_ready']).default('idea'),
    documentationReadiness: buildTextField(1500),
    inventorOwnership: zod_1.z.enum(['individual', 'team', 'organization']).default('individual'),
    developmentContext: buildTextField(2000),
    targetMarkets: buildTextField(2000),
    commercializationStrategy: zod_1.z.enum(['build_startup', 'license', 'sell', 'partnership']).default('build_startup'),
    publicDisclosureStatus: buildTextField(1500),
    legalAgreements: buildTextField(1500),
    ipProtectionType: zod_1.z.enum(['patent', 'copyright', 'trademark', 'design']).default('patent'),
})
    .default(DEFAULT_REGISTRATION_PROFILE);
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
    businessProfile: startupBusinessProfileSchema,
    registrationProfile: startupRegistrationProfileSchema,
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
exports.startupDocumentUploadSchema = zod_1.z.object({
    category: startupDocumentCategorySchema,
    note: zod_1.z.string().trim().max(300).optional(),
});
const clearReviewMetadata = (startup) => {
    startup.reviewRequestedAt = undefined;
    startup.adminReviewedAt = undefined;
    startup.adminReviewedBy = null;
    startup.adminNotes = undefined;
};
const normalizeRegistrationProfile = (registrationProfile) => {
    const profile = startupRegistrationProfileSchema.parse(registrationProfile ?? DEFAULT_REGISTRATION_PROFILE);
    return {
        problemStatement: profile.problemStatement.trim(),
        solutionDifferentiation: profile.solutionDifferentiation.trim(),
        coreInnovation: profile.coreInnovation.trim(),
        priorArtStatus: profile.priorArtStatus.trim(),
        workingMechanism: profile.workingMechanism.trim(),
        keyComponents: profile.keyComponents.trim(),
        developmentStage: profile.developmentStage,
        documentationReadiness: profile.documentationReadiness.trim(),
        inventorOwnership: profile.inventorOwnership,
        developmentContext: profile.developmentContext.trim(),
        targetMarkets: profile.targetMarkets.trim(),
        commercializationStrategy: profile.commercializationStrategy,
        publicDisclosureStatus: profile.publicDisclosureStatus.trim(),
        legalAgreements: profile.legalAgreements.trim(),
        ipProtectionType: profile.ipProtectionType,
    };
};
const buildStartupInput = (source) => {
    const businessProfileSource = source.businessProfile ?? {};
    const registrationProfileSource = source.registrationProfile ?? {};
    const tractionSource = source.traction ?? {};
    const businessProfile = {
        ...DEFAULT_BUSINESS_PROFILE,
        ...businessProfileSource,
    };
    const registrationProfile = {
        ...DEFAULT_REGISTRATION_PROFILE,
        ...registrationProfileSource,
    };
    return {
        projectId: source.projectId ? String(source.projectId) : undefined,
        name: typeof source.name === 'string' ? source.name : '',
        tagline: typeof source.tagline === 'string' ? source.tagline : '',
        category: typeof source.category === 'string' ? source.category : '',
        stage: source.stage,
        fundingNeeded: typeof source.fundingNeeded === 'number' ? source.fundingNeeded : undefined,
        activeProducts: typeof source.activeProducts === 'number' ? source.activeProducts : 1,
        teamSize: typeof source.teamSize === 'number' ? source.teamSize : 1,
        traction: {
            patentFiled: Boolean(tractionSource.patentFiled),
            mvpBuilt: Boolean(tractionSource.mvpBuilt),
            revenueGenerating: Boolean(tractionSource.revenueGenerating),
            ...(typeof tractionSource.usersCount === 'number' ? { usersCount: tractionSource.usersCount } : {}),
        },
        businessProfile,
        registrationProfile,
    };
};
const normalizeStartupPayload = (payload) => {
    const normalizedPayload = exports.startupSchema.parse(payload);
    const registrationProfile = normalizeRegistrationProfile(normalizedPayload.registrationProfile ?? DEFAULT_REGISTRATION_PROFILE);
    const businessProfile = normalizedPayload.businessProfile ?? DEFAULT_BUSINESS_PROFILE;
    return {
        ...normalizedPayload,
        name: normalizedPayload.name.trim(),
        tagline: normalizedPayload.tagline.trim(),
        category: normalizedPayload.category.trim(),
        businessProfile: {
            problemStatement: businessProfile.problemStatement.trim(),
            solutionSummary: businessProfile.solutionSummary.trim(),
            targetCustomers: businessProfile.targetCustomers.trim(),
            marketAnalysis: businessProfile.marketAnalysis.trim(),
            revenueModel: businessProfile.revenueModel.trim(),
            goToMarketPlan: businessProfile.goToMarketPlan.trim(),
        },
        registrationProfile,
        traction: normalizedPayload.traction,
    };
};
const getWorkspaceMemberIds = (workspace, userId) => {
    const memberIds = [
        String(workspace.ownerId),
        ...workspace.teamMemberIds.map((memberId) => String(memberId)),
    ];
    if (userId) {
        memberIds.push(String(userId));
    }
    return [...new Set(memberIds)].map((memberId) => new mongoose_1.Types.ObjectId(memberId));
};
const resolveLinkedWorkspace = async (userId, projectId) => {
    if (!projectId) {
        return null;
    }
    const workspace = await workspace_model_1.Workspace.findOne({
        _id: projectId,
        isActive: true,
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
    })
        .select('_id ownerId teamMemberIds isActive')
        .lean();
    if (!workspace) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace that you belong to before saving this startup.');
    }
    return workspace;
};
const applyWorkspaceContextToStartupPayload = async (userId, payload) => {
    const workspace = await resolveLinkedWorkspace(userId, payload.projectId);
    const founderIds = [new mongoose_1.Types.ObjectId(userId)];
    const teamMemberIds = [];
    if (workspace) {
        const allMemberIds = getWorkspaceMemberIds(workspace);
        for (const memberId of allMemberIds) {
            if (String(memberId) !== String(userId)) {
                teamMemberIds.push(memberId);
            }
        }
    }
    const totalMembers = founderIds.length + teamMemberIds.length;
    const teamSize = workspace ? Math.max(totalMembers, payload.teamSize || 1) : Math.max(payload.teamSize || 1, 1);
    return {
        ...payload,
        projectId: workspace ? String(workspace._id) : undefined,
        founderIds,
        teamMemberIds,
        teamSize,
    };
};
const getAccessibleWorkspaceIds = async (userId) => {
    const workspaces = await workspace_model_1.Workspace.find({
        isActive: true,
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
    })
        .select('_id')
        .lean();
    return workspaces.map((workspace) => workspace._id);
};
const buildAccessibleStartupQuery = (userId, workspaceIds) => ({
    isActive: true,
    $or: [
        { founderIds: userId },
        { teamMemberIds: userId },
        ...(workspaceIds.length > 0 ? [{ projectId: { $in: workspaceIds } }] : []),
    ],
});
const getRequiredStartupDocumentCategories = (startup) => {
    return startup.registrationProfile?.developmentStage === 'idea'
        ? ['design_plan_sketch']
        : ['technical_documentation'];
};
const buildStartupReadiness = (startup) => {
    const missingItems = [];
    const documents = startup.documents ?? [];
    const uploadedDocumentCategories = Array.from(new Set(documents
        .map((document) => document.category)
        .filter((category) => Boolean(category))));
    const uploadedCategorySet = new Set(uploadedDocumentCategories);
    const requiredDocumentCategories = getRequiredStartupDocumentCategories(startup);
    const addMissing = (condition, label) => {
        if (condition)
            missingItems.push(label);
    };
    addMissing(!startup.name?.trim(), 'startup name');
    addMissing(!startup.tagline?.trim(), 'startup tagline');
    addMissing(!startup.category?.trim(), 'startup category');
    addMissing(startup.founderIds.length === 0, 'at least one founder');
    addMissing((startup.registrationProfile?.problemStatement?.trim().length ?? 0) < 40, 'IPR problem statement');
    addMissing((startup.registrationProfile?.solutionDifferentiation?.trim().length ?? 0) < 40, 'solution differentiation');
    addMissing((startup.registrationProfile?.coreInnovation?.trim().length ?? 0) < 30, 'core innovation');
    addMissing((startup.registrationProfile?.priorArtStatus?.trim().length ?? 0) < 20, 'prior art status');
    addMissing((startup.registrationProfile?.workingMechanism?.trim().length ?? 0) < 40, 'working mechanism');
    addMissing((startup.registrationProfile?.keyComponents?.trim().length ?? 0) < 20, 'key components');
    addMissing(!startup.registrationProfile?.developmentStage?.trim(), 'innovation stage');
    addMissing((startup.registrationProfile?.documentationReadiness?.trim().length ?? 0) < 10, 'documentation readiness');
    addMissing(!startup.registrationProfile?.inventorOwnership?.trim(), 'inventor ownership');
    addMissing((startup.registrationProfile?.developmentContext?.trim().length ?? 0) < 20, 'development context');
    addMissing((startup.registrationProfile?.targetMarkets?.trim().length ?? 0) < 20, 'target markets');
    addMissing(!startup.registrationProfile?.commercializationStrategy?.trim(), 'commercialization strategy');
    addMissing((startup.registrationProfile?.publicDisclosureStatus?.trim().length ?? 0) < 10, 'public disclosure status');
    addMissing((startup.registrationProfile?.legalAgreements?.trim().length ?? 0) < 10, 'legal agreements');
    addMissing(!startup.registrationProfile?.ipProtectionType?.trim(), 'IP protection type');
    addMissing(!startup.pitchDeckUrl && !uploadedCategorySet.has('business_plan'), 'business plan or pitch deck upload');
    for (const category of requiredDocumentCategories) {
        addMissing(!uploadedCategorySet.has(category), documentLabelMap[category]);
    }
    return {
        isReviewReady: missingItems.length === 0,
        missingItems,
        requiredDocumentCategories,
        uploadedDocumentCategories,
    };
};
const formatReadinessErrorMessage = (readiness) => {
    if (readiness.missingItems.length === 0)
        return 'Startup profile is incomplete for review.';
    const topItems = readiness.missingItems.slice(0, 5).join(', ');
    return readiness.missingItems.length > 5
        ? `Startup profile is incomplete for review. Complete: ${topItems}, and ${readiness.missingItems.length - 5} more.`
        : `Startup profile is incomplete for review. Complete: ${topItems}.`;
};
const sanitizeStartupForClient = (startup) => ({
    ...startup,
    documents: (startup.documents ?? []).map((document) => ({
        _id: document._id,
        category: document.category,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        fileName: document.fileName,
        fileSizeBytes: document.fileSizeBytes,
        uploadedAt: document.uploadedAt,
        ...(document.note ? { note: document.note } : {}),
    })),
    readiness: buildStartupReadiness(startup),
});
const serializeStartup = (startup) => {
    const base = typeof startup.toObject === 'function'
        ? startup.toObject()
        : startup;
    return sanitizeStartupForClient(base);
};
const createStartupProfile = async (userId, payload) => {
    const normalizedPayload = normalizeStartupPayload(buildStartupInput(payload));
    const startupPayload = await applyWorkspaceContextToStartupPayload(userId, normalizedPayload);
    const startup = await startup_model_1.Startup.create({
        ...startupPayload,
    });
    return serializeStartup(startup);
};
exports.createStartupProfile = createStartupProfile;
const getMyStartups = async (userId) => {
    const workspaceIds = await getAccessibleWorkspaceIds(userId);
    const startups = await startup_model_1.Startup.find(buildAccessibleStartupQuery(userId, workspaceIds))
        .sort({ updatedAt: -1 })
        .lean();
    return startups.map((startup) => serializeStartup(startup));
};
exports.getMyStartups = getMyStartups;
const getStartupById = async (startupId, userId) => {
    const workspaceIds = await getAccessibleWorkspaceIds(userId);
    const startup = await startup_model_1.Startup.findOne({
        _id: startupId,
        ...buildAccessibleStartupQuery(userId, workspaceIds),
    }).lean();
    if (!startup) {
        throw new ApiError_1.ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
    }
    return serializeStartup(startup);
};
exports.getStartupById = getStartupById;
const getStartupForFounder = async (startupId, userId) => {
    const workspaceIds = await getAccessibleWorkspaceIds(userId);
    const startup = await startup_model_1.Startup.findOne({
        _id: startupId,
        ...buildAccessibleStartupQuery(userId, workspaceIds),
    });
    if (!startup) {
        throw new ApiError_1.ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
    }
    return startup;
};
exports.getStartupForFounder = getStartupForFounder;
const updateStartupProfile = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const startupSnapshot = startup.toObject();
    const mergedPayload = buildStartupInput({
        ...startupSnapshot,
        ...payload,
        businessProfile: {
            ...(startupSnapshot.businessProfile ?? {}),
            ...(payload.businessProfile ?? {}),
        },
        registrationProfile: {
            ...(startupSnapshot.registrationProfile ?? {}),
            ...(payload.registrationProfile ?? {}),
        },
        traction: {
            ...(startupSnapshot.traction ?? {}),
            ...(payload.traction ?? {}),
        },
    });
    const normalizedPayload = normalizeStartupPayload(mergedPayload);
    const startupPayload = await applyWorkspaceContextToStartupPayload(userId, normalizedPayload);
    // Preserve existing founderIds — don't demote co-founders on update
    const existingFounderSet = new Set(startup.founderIds.map((id) => String(id)));
    const combinedFounderIds = [...startup.founderIds];
    for (const newId of startupPayload.founderIds) {
        if (!existingFounderSet.has(String(newId))) {
            combinedFounderIds.push(newId);
        }
    }
    startupPayload.founderIds = combinedFounderIds;
    // Team members = workspace members who are NOT founders
    const founderSet = new Set(combinedFounderIds.map((id) => String(id)));
    startupPayload.teamMemberIds = startupPayload.teamMemberIds.filter((id) => !founderSet.has(String(id)));
    Object.assign(startup, startupPayload);
    if (startup.reviewStatus === 'review_requested') {
        startup.reviewStatus = 'draft';
        clearReviewMetadata(startup);
    }
    await startup.save();
    return serializeStartup(startup);
};
exports.updateStartupProfile = updateStartupProfile;
const requestStartupReview = async (startupId, userId) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const readiness = buildStartupReadiness(startup.toObject());
    if (!readiness.isReviewReady) {
        throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
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
    return serializeStartup(startup);
};
exports.requestStartupReview = requestStartupReview;
const launchStartup = async (startupId, userId, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const readiness = buildStartupReadiness(startup.toObject());
    if (!readiness.isReviewReady) {
        throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
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
    return serializeStartup(startup);
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
    return serializeStartup(startup);
};
exports.uploadPitchDeck = uploadPitchDeck;
const uploadStartupDocument = async (startupId, userId, file, payload) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const uploaded = await (0, cloudinaryService_1.uploadToCloudinary)(file.buffer, 'promove/startup-documents', fileType === 'pdf' ? 'raw' : 'image', fileType === 'pdf' ? { format: 'pdf' } : undefined);
    const existingDocument = startup.documents.find((document) => document.category === payload.category);
    if (existingDocument?.cloudinaryPublicId) {
        await (0, cloudinaryService_1.deleteFromCloudinary)(existingDocument.cloudinaryPublicId, existingDocument.fileType === 'pdf' ? 'raw' : 'image');
    }
    startup.documents = startup.documents.filter((document) => document.category !== payload.category);
    startup.documents.push({
        _id: new mongoose_1.Types.ObjectId(),
        category: payload.category,
        fileUrl: uploaded.secure_url,
        fileType,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        uploadedAt: new Date(),
        uploadedBy: new mongoose_1.Types.ObjectId(userId),
        ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
        cloudinaryPublicId: uploaded.public_id,
    });
    if (startup.reviewStatus === 'review_requested') {
        startup.reviewStatus = 'draft';
        clearReviewMetadata(startup);
    }
    await startup.save();
    return serializeStartup(startup);
};
exports.uploadStartupDocument = uploadStartupDocument;
const deleteStartupDocument = async (startupId, userId, documentId) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const document = startup.documents.find((item) => String(item._id) === documentId);
    if (!document) {
        throw new ApiError_1.ApiError(404, 'STARTUP_DOCUMENT_NOT_FOUND', 'Startup document not found.');
    }
    if (document.cloudinaryPublicId) {
        await (0, cloudinaryService_1.deleteFromCloudinary)(document.cloudinaryPublicId, document.fileType === 'pdf' ? 'raw' : 'image');
    }
    startup.documents = startup.documents.filter((item) => String(item._id) !== documentId);
    if (startup.reviewStatus === 'review_requested') {
        startup.reviewStatus = 'draft';
        clearReviewMetadata(startup);
    }
    await startup.save();
    return serializeStartup(startup);
};
exports.deleteStartupDocument = deleteStartupDocument;
const promoteToCoFounder = async (startupId, userId, memberId) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    const isTeamMember = startup.teamMemberIds.some((id) => String(id) === memberId);
    if (!isTeamMember) {
        throw new ApiError_1.ApiError(400, 'NOT_A_TEAM_MEMBER', 'User is not a team member of this startup.');
    }
    const alreadyFounder = startup.founderIds.some((id) => String(id) === memberId);
    if (alreadyFounder) {
        throw new ApiError_1.ApiError(400, 'ALREADY_FOUNDER', 'User is already a founder.');
    }
    startup.founderIds.push(new mongoose_1.Types.ObjectId(memberId));
    startup.teamMemberIds = startup.teamMemberIds.filter((id) => String(id) !== memberId);
    await startup.save();
    return serializeStartup(startup);
};
exports.promoteToCoFounder = promoteToCoFounder;
const demoteFromCoFounder = async (startupId, userId, memberId) => {
    const startup = await (0, exports.getStartupForFounder)(startupId, userId);
    if (String(memberId) === String(userId)) {
        throw new ApiError_1.ApiError(400, 'CANNOT_DEMOTE_SELF', 'You cannot demote yourself from founder.');
    }
    const isFounder = startup.founderIds.some((id) => String(id) === memberId);
    if (!isFounder) {
        throw new ApiError_1.ApiError(400, 'NOT_A_FOUNDER', 'User is not a founder of this startup.');
    }
    startup.founderIds = startup.founderIds.filter((id) => String(id) !== memberId);
    startup.teamMemberIds.push(new mongoose_1.Types.ObjectId(memberId));
    await startup.save();
    return serializeStartup(startup);
};
exports.demoteFromCoFounder = demoteFromCoFounder;
const listStartupsForAdmin = async (status) => {
    const query = status ? { isActive: true, reviewStatus: status } : { isActive: true };
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
    return startups.map((startup) => {
        const readiness = buildStartupReadiness(startup);
        return {
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
            registrationProfile: startup.registrationProfile,
            readiness,
            documents: startup.documents.map((document) => ({
                _id: String(document._id),
                category: document.category,
                fileUrl: document.fileUrl,
                fileType: document.fileType,
                fileName: document.fileName,
                fileSizeBytes: document.fileSizeBytes,
                uploadedAt: document.uploadedAt.toISOString(),
                ...(document.note ? { note: document.note } : {}),
            })),
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
        };
    });
};
exports.listStartupsForAdmin = listStartupsForAdmin;
const reviewStartupSubmission = async (adminId, startupId, payload) => {
    const startup = await startup_model_1.Startup.findById(startupId);
    if (!startup || !startup.isActive) {
        throw new ApiError_1.ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }
    if (payload.decision === 'approved') {
        const readiness = buildStartupReadiness(startup.toObject());
        if (!readiness.isReviewReady) {
            throw new ApiError_1.ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
        }
    }
    startup.reviewStatus = payload.decision;
    startup.adminReviewedAt = new Date();
    startup.adminReviewedBy = new mongoose_1.Types.ObjectId(adminId);
    startup.adminNotes = payload.adminNotes?.trim() || undefined;
    if (payload.decision === 'approved') {
        startup.reviewRequestedAt = startup.reviewRequestedAt ?? new Date();
    }
    await startup.save();
    return serializeStartup(startup);
};
exports.reviewStartupSubmission = reviewStartupSubmission;
