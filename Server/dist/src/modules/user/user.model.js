"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const roles_types_1 = require("../../types/roles.types");
const score_utils_1 = require("../innovationScore/score.utils");
const institutionVerification_constants_1 = require("../institution/institutionVerification.constants");
const scoreBreakdownSchema = new mongoose_1.Schema({
    problemsClaimed: { type: Number, default: 0 },
    skillsCompleted: { type: Number, default: 0 },
    progressUploads: { type: Number, default: 0 },
    patentsSubmitted: { type: Number, default: 0 },
    patentsApproved: { type: Number, default: 0 },
    mvpsVerified: { type: Number, default: 0 },
    marketReadyVerified: { type: Number, default: 0 },
    startupsLaunched: { type: Number, default: 0 },
    awardsApproved: { type: Number, default: 0 },
}, { _id: false });
const institutionPolicySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    status: {
        type: String,
        enum: ['Active', 'On Track', 'Pending', 'Inactive'],
        required: true,
    },
    lastUpdated: {
        type: Date,
        default: undefined,
    },
}, { _id: false });
const institutionStatsSchema = new mongoose_1.Schema({
    totalInnovationActivities: { type: Number, default: 0 },
    patentsFiled: { type: Number, default: 0 },
    totalMentoringHours: { type: Number, default: 0 },
    startupsLaunched: { type: Number, default: 0 },
    industryCollaborations: { type: Number, default: 0 },
    totalHRConnections: { type: Number, default: undefined },
    studentsPlaced: { type: Number, default: undefined },
    directShortlistsThisQuarter: { type: Number, default: undefined },
    topHiringSector: { type: String, default: undefined },
}, { _id: false });
const institutionProfileSchema = new mongoose_1.Schema({
    institutionName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    location: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    totalStudentsEnrolled: {
        type: Number,
        required: true,
        min: 0,
    },
    academicYear: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
    },
    iicStarRating: {
        type: Number,
        required: true,
        min: 0,
        max: 5,
        default: 0,
    },
    iicLastUpdated: {
        type: Date,
        default: undefined,
    },
    policies: {
        type: [institutionPolicySchema],
        default: [],
    },
    stats: {
        type: institutionStatsSchema,
        default: () => ({
            totalInnovationActivities: 0,
            patentsFiled: 0,
            totalMentoringHours: 0,
            startupsLaunched: 0,
            industryCollaborations: 0,
        }),
    },
}, { _id: false });
const institutionVerificationReadinessSchema = new mongoose_1.Schema({
    isReadyForReview: {
        type: Boolean,
        default: false,
    },
    requiredDocumentCategories: {
        type: [{ type: String, enum: institutionVerification_constants_1.INSTITUTION_DOCUMENT_CATEGORIES }],
        default: [],
    },
    uploadedDocumentCategories: {
        type: [{ type: String, enum: institutionVerification_constants_1.INSTITUTION_DOCUMENT_CATEGORIES }],
        default: [],
    },
    missingItems: {
        type: [String],
        default: [],
    },
}, { _id: false });
const institutionVerificationDocumentSchema = new mongoose_1.Schema({
    category: {
        type: String,
        enum: institutionVerification_constants_1.INSTITUTION_DOCUMENT_CATEGORIES,
        required: true,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    fileType: {
        type: String,
        enum: ['pdf', 'image'],
        required: true,
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    fileSizeBytes: {
        type: Number,
        required: true,
        min: 1,
    },
    uploadedAt: {
        type: Date,
        default: () => new Date(),
    },
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    cloudinaryPublicId: {
        type: String,
        default: undefined,
    },
}, { _id: true });
const institutionVerificationSchema = new mongoose_1.Schema({
    regulatoryBodies: {
        type: [{ type: String, enum: institutionVerification_constants_1.INSTITUTION_REGULATORY_BODIES }],
        default: [],
    },
    affiliationName: {
        type: String,
        trim: true,
        maxlength: 160,
        default: undefined,
    },
    websiteUrl: {
        type: String,
        default: undefined,
    },
    referenceCode: {
        type: String,
        trim: true,
        maxlength: 80,
        default: undefined,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: undefined,
    },
    documents: {
        type: [institutionVerificationDocumentSchema],
        default: [],
    },
    readiness: {
        type: institutionVerificationReadinessSchema,
        default: () => ({
            isReadyForReview: false,
            requiredDocumentCategories: [],
            uploadedDocumentCategories: [],
            missingItems: [],
        }),
    },
}, { _id: false });
const connectedAccountSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        default: null,
    },
    username: {
        type: String,
        default: null,
    },
    accessToken: {
        type: String,
        default: null,
        select: false,
    },
    connectedAt: {
        type: Date,
        default: null,
    },
    lastSyncedAt: {
        type: Date,
        default: null,
    },
}, { _id: false });
const skillSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    category: {
        type: String,
        enum: ['programming', 'design', 'business', 'research', 'other'],
        default: 'other',
    },
    source: {
        type: String,
        enum: ['platform', 'github', 'linkedin', 'manual'],
        required: true,
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner',
    },
    endorsements: {
        type: Number,
        default: 0,
        min: 0,
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });
const experienceSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    company: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    type: {
        type: String,
        enum: ['full_time', 'part_time', 'internship', 'freelance', 'volunteer'],
        default: 'internship',
    },
    location: {
        type: String,
        default: '',
        maxlength: 100,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        default: null,
    },
    isCurrent: {
        type: Boolean,
        default: false,
    },
    description: {
        type: String,
        maxlength: 1000,
        default: '',
    },
    skills: {
        type: [String],
        default: [],
    },
    source: {
        type: String,
        enum: ['manual', 'linkedin'],
        default: 'manual',
    },
    linkedinId: {
        type: String,
        default: null,
    },
}, { _id: true });
const educationSchema = new mongoose_1.Schema({
    institution: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    degree: {
        type: String,
        default: '',
        maxlength: 160,
    },
    fieldOfStudy: {
        type: String,
        default: '',
        maxlength: 160,
    },
    startYear: {
        type: Number,
        min: 1900,
        max: 3000,
        default: undefined,
    },
    endYear: {
        type: Number,
        min: 1900,
        max: 3000,
        default: null,
    },
    isCurrent: {
        type: Boolean,
        default: false,
    },
    grade: {
        type: String,
        default: '',
        maxlength: 80,
    },
    activities: {
        type: String,
        default: '',
        maxlength: 500,
    },
    description: {
        type: String,
        default: '',
        maxlength: 1000,
    },
    source: {
        type: String,
        enum: ['manual', 'linkedin'],
        default: 'manual',
    },
}, { _id: true });
const certificationSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    issuingOrganization: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    issueDate: {
        type: Date,
        default: null,
    },
    expiryDate: {
        type: Date,
        default: null,
    },
    credentialId: {
        type: String,
        default: '',
        maxlength: 120,
    },
    credentialUrl: {
        type: String,
        default: '',
        maxlength: 500,
    },
    source: {
        type: String,
        enum: ['manual', 'linkedin'],
        default: 'manual',
    },
}, { _id: true });
const portfolioProjectSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    description: {
        type: String,
        maxlength: 1000,
        default: '',
    },
    techStack: {
        type: [String],
        default: [],
    },
    repoUrl: {
        type: String,
        default: null,
    },
    liveUrl: {
        type: String,
        default: null,
    },
    coverImageUrl: {
        type: String,
        default: null,
    },
    startDate: {
        type: Date,
        default: null,
    },
    endDate: {
        type: Date,
        default: null,
    },
    isCurrent: {
        type: Boolean,
        default: false,
    },
    source: {
        type: String,
        enum: ['manual', 'github'],
        default: 'manual',
    },
    githubRepoId: {
        type: String,
        default: null,
    },
    stars: {
        type: Number,
        default: 0,
        min: 0,
    },
    forks: {
        type: Number,
        default: 0,
        min: 0,
    },
    languages: {
        type: [String],
        default: [],
    },
}, { _id: true });
const resumeSchema = new mongoose_1.Schema({
    fileUrl: {
        type: String,
        default: null,
    },
    fileName: {
        type: String,
        default: null,
    },
    uploadedAt: {
        type: Date,
        default: null,
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
}, { _id: false });
const githubLanguageStatSchema = new mongoose_1.Schema({
    language: {
        type: String,
        required: true,
        trim: true,
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
}, { _id: false });
const githubStatsSchema = new mongoose_1.Schema({
    totalRepos: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalStars: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalForks: {
        type: Number,
        default: 0,
        min: 0,
    },
    topLanguages: {
        type: [githubLanguageStatSchema],
        default: [],
    },
    contributionsLastYear: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastSyncedAt: {
        type: Date,
        default: null,
    },
}, { _id: false });
const githubRecentCommitSchema = new mongoose_1.Schema({
    sha: {
        type: String,
        required: true,
        trim: true,
        maxlength: 64,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    committedAt: {
        type: Date,
        required: true,
    },
    url: {
        type: String,
        default: null,
    },
}, { _id: false });
const githubImportedRepoSchema = new mongoose_1.Schema({
    repoId: {
        type: String,
        required: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    description: {
        type: String,
        default: '',
        maxlength: 1000,
    },
    url: {
        type: String,
        required: true,
    },
    owner: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    },
    isPrivate: {
        type: Boolean,
        default: false,
    },
    defaultBranch: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    primaryLanguage: {
        type: String,
        default: null,
        maxlength: 80,
    },
    languages: {
        type: [String],
        default: [],
    },
    stars: {
        type: Number,
        default: 0,
        min: 0,
    },
    forks: {
        type: Number,
        default: 0,
        min: 0,
    },
    openIssues: {
        type: Number,
        default: 0,
        min: 0,
    },
    pushedAt: {
        type: Date,
        default: null,
    },
    importedAt: {
        type: Date,
        required: true,
    },
    recentCommits: {
        type: [githubRecentCommitSchema],
        default: [],
    },
}, { _id: false });
const githubActivityEventSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['push', 'pull_request', 'issue', 'release', 'fork', 'watch', 'other'],
        required: true,
    },
    repoFullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    summary: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    url: {
        type: String,
        default: null,
    },
    occurredAt: {
        type: Date,
        required: true,
    },
    commitCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isPrivate: {
        type: Boolean,
        default: false,
    },
}, { _id: false });
const githubProofSchema = new mongoose_1.Schema({
    importedRepoIds: {
        type: [String],
        default: [],
    },
    importedRepos: {
        type: [githubImportedRepoSchema],
        default: [],
    },
    recentActivity: {
        type: [githubActivityEventSchema],
        default: [],
    },
    commitCount30Days: {
        type: Number,
        default: 0,
        min: 0,
    },
    activeDays30Days: {
        type: Number,
        default: 0,
        min: 0,
    },
    pushEvents30Days: {
        type: Number,
        default: 0,
        min: 0,
    },
    pullRequests30Days: {
        type: Number,
        default: 0,
        min: 0,
    },
    issues30Days: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastSyncedAt: {
        type: Date,
        default: null,
    },
}, { _id: false });
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
    role: {
        type: String,
        enum: roles_types_1.USER_ROLES,
        required: true,
    },
    displayName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    avatar: {
        type: String,
        default: undefined,
    },
    bio: {
        type: String,
        default: '',
        maxlength: 500,
    },
    headline: {
        type: String,
        default: '',
        maxlength: 120,
    },
    location: {
        type: String,
        default: '',
        maxlength: 100,
    },
    websiteUrl: {
        type: String,
        default: null,
    },
    githubUrl: {
        type: String,
        default: null,
    },
    linkedinUrl: {
        type: String,
        default: null,
    },
    domain: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 120,
    },
    profileComplete: {
        type: Boolean,
        default: false,
    },
    registrationStage: {
        type: String,
        enum: ['basic', 'profile_setup', 'institution_pending', 'institution_verified', 'complete'],
        default: 'basic',
    },
    innovationScore: {
        type: Number,
        default: 0,
    },
    scoreBreakdown: {
        type: scoreBreakdownSchema,
        default: score_utils_1.createDefaultScoreBreakdown,
    },
    accessGrantedBy: {
        type: String,
        enum: [
            'self_registered',
            'institution_token',
            'institution_roster',
            'institution_admin',
            'admin',
            'startup_school',
            'skill_dev',
        ],
        required: true,
    },
    accessExpiresAt: {
        type: Date,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isProfilePublic: {
        type: Boolean,
        default: true,
    },
    profileSlug: {
        type: String,
        default: undefined,
        trim: true,
    },
    lastLogin: {
        type: Date,
        default: undefined,
    },
    discoverableToRecruiters: {
        type: Boolean,
        default: false,
    },
    mustChangePasswordOnNextLogin: {
        type: Boolean,
        default: false,
    },
    institutionToken: {
        type: String,
        default: null,
    },
    institutionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    institutionProfile: {
        type: institutionProfileSchema,
        default: undefined,
    },
    institutionVerification: {
        type: institutionVerificationSchema,
        default: undefined,
    },
    institutionVerifiedAt: {
        type: Date,
        default: null,
    },
    institutionVerificationStatus: {
        type: String,
        enum: ['none', 'pending', 'verified', 'failed'],
        default: 'none',
    },
    verificationStatus: {
        type: String,
        enum: ['not_required', 'pending', 'verified', 'rejected'],
        default: 'not_required',
    },
    verificationRequestedAt: {
        type: Date,
        default: undefined,
    },
    verifiedAt: {
        type: Date,
        default: undefined,
    },
    verificationRejectedAt: {
        type: Date,
        default: undefined,
    },
    verificationRejectedReason: {
        type: String,
        default: undefined,
        maxlength: 300,
    },
    adminApprovalStatus: {
        type: String,
        enum: ['not_required', 'pending', 'approved', 'rejected'],
        default: 'not_required',
    },
    adminApprovalRequestedAt: {
        type: Date,
        default: undefined,
    },
    adminApprovedAt: {
        type: Date,
        default: undefined,
    },
    adminApprovedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    adminApprovalRejectedAt: {
        type: Date,
        default: undefined,
    },
    adminApprovalRejectedReason: {
        type: String,
        default: undefined,
        maxlength: 300,
    },
    connectedAccounts: {
        type: new mongoose_1.Schema({
            github: {
                type: connectedAccountSchema,
                default: () => ({
                    userId: null,
                    username: null,
                    accessToken: null,
                    connectedAt: null,
                    lastSyncedAt: null,
                }),
            },
            google: {
                type: connectedAccountSchema,
                default: () => ({
                    userId: null,
                    username: null,
                    accessToken: null,
                    connectedAt: null,
                    lastSyncedAt: null,
                }),
            },
            linkedin: {
                type: connectedAccountSchema,
                default: () => ({
                    userId: null,
                    username: null,
                    accessToken: null,
                    connectedAt: null,
                    lastSyncedAt: null,
                }),
            },
        }, { _id: false }),
        default: () => ({
            github: {
                userId: null,
                username: null,
                accessToken: null,
                connectedAt: null,
                lastSyncedAt: null,
            },
            google: {
                userId: null,
                username: null,
                accessToken: null,
                connectedAt: null,
                lastSyncedAt: null,
            },
            linkedin: {
                userId: null,
                username: null,
                accessToken: null,
                connectedAt: null,
                lastSyncedAt: null,
            },
        }),
    },
    skills: {
        type: [skillSchema],
        default: [],
    },
    experience: {
        type: [experienceSchema],
        default: [],
    },
    education: {
        type: [educationSchema],
        default: [],
    },
    certifications: {
        type: [certificationSchema],
        default: [],
    },
    portfolioProjects: {
        type: [portfolioProjectSchema],
        default: [],
    },
    resume: {
        type: resumeSchema,
        default: () => ({
            fileUrl: null,
            fileName: null,
            uploadedAt: null,
            isPublic: false,
        }),
    },
    githubStats: {
        type: githubStatsSchema,
        default: () => ({
            totalRepos: 0,
            totalStars: 0,
            totalForks: 0,
            topLanguages: [],
            contributionsLastYear: 0,
            lastSyncedAt: null,
        }),
    },
    githubProof: {
        type: githubProofSchema,
        default: () => ({
            importedRepoIds: [],
            importedRepos: [],
            recentActivity: [],
            commitCount30Days: 0,
            activeDays30Days: 0,
            pushEvents30Days: 0,
            pullRequests30Days: 0,
            issues30Days: 0,
            lastSyncedAt: null,
        }),
    },
    teamRequestsSent: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamRequest' }],
        default: [],
    },
    teamRequestsReceived: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamRequest' }],
        default: [],
    },
}, {
    timestamps: true,
});
userSchema.index({ role: 1, innovationScore: -1 });
userSchema.index({ institutionId: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, institutionId: 1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ profileSlug: 1 }, { unique: true, sparse: true });
userSchema.index({ 'connectedAccounts.github.username': 1 }, { sparse: true });
userSchema.index({ 'connectedAccounts.google.userId': 1 }, { sparse: true });
userSchema.index({ 'connectedAccounts.linkedin.userId': 1 }, { sparse: true });
userSchema.index({ 'skills.name': 1 });
userSchema.index({ isProfilePublic: 1, role: 1 });
userSchema.index({ registrationStage: 1 });
userSchema.index({ adminApprovalStatus: 1, createdAt: -1 });
exports.User = (0, mongoose_1.model)('User', userSchema);
