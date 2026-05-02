import { HydratedDocument, Schema, model } from 'mongoose';
import { USER_ROLES } from '../../types/roles.types';
import { createDefaultScoreBreakdown } from '../innovationScore/score.utils';
import {
  INSTITUTION_DOCUMENT_CATEGORIES,
  INSTITUTION_REGULATORY_BODIES,
} from '../institution/institutionVerification.constants';
import { IUser } from './user.types';

const scoreBreakdownSchema = new Schema<IUser['scoreBreakdown']>(
  {
    problemsClaimed: { type: Number, default: 0 },
    skillsCompleted: { type: Number, default: 0 },
    progressUploads: { type: Number, default: 0 },
    patentsSubmitted: { type: Number, default: 0 },
    patentsApproved: { type: Number, default: 0 },
    mvpsVerified: { type: Number, default: 0 },
    marketReadyVerified: { type: Number, default: 0 },
    startupsLaunched: { type: Number, default: 0 },
    awardsApproved: { type: Number, default: 0 },
  },
  { _id: false },
);

const institutionPolicySchema = new Schema<NonNullable<IUser['institutionProfile']>['policies'][number]>(
  {
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
    evidence: {
      type: [
        new Schema<NonNullable<IUser['institutionProfile']>['policies'][number]['evidence'][number]>(
          {
            title: {
              type: String,
              required: true,
              trim: true,
              maxlength: 160,
            },
            type: {
              type: String,
              enum: [
                'policy_document',
                'activity_report',
                'attendance_log',
                'photo',
                'video',
                'meeting_minutes',
                'certificate',
                'mou',
                'external_audit',
                'other',
              ],
              required: true,
            },
            url: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2048,
            },
            notes: {
              type: String,
              trim: true,
              maxlength: 600,
              default: undefined,
            },
            submittedAt: {
              type: Date,
              default: undefined,
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const institutionStatsSchema = new Schema<NonNullable<IUser['institutionProfile']>['stats']>(
  {
    totalInnovationActivities: { type: Number, default: 0 },
    patentsFiled: { type: Number, default: 0 },
    totalMentoringHours: { type: Number, default: 0 },
    startupsLaunched: { type: Number, default: 0 },
    industryCollaborations: { type: Number, default: 0 },
    totalHRConnections: { type: Number, default: undefined },
    studentsPlaced: { type: Number, default: undefined },
    directShortlistsThisQuarter: { type: Number, default: undefined },
    topHiringSector: { type: String, default: undefined },
  },
  { _id: false },
);

const institutionProfileSchema = new Schema<NonNullable<IUser['institutionProfile']>>(
  {
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
    organizationType: {
      type: String,
      trim: true,
      maxlength: 120,
      default: undefined,
    },
    foundedYear: {
      type: Number,
      min: 1800,
      max: 3000,
      default: undefined,
    },
    specialties: {
      type: [String],
      default: [],
    },
    locations: {
      type: [String],
      default: [],
    },
    alumniCount: {
      type: Number,
      min: 0,
      default: undefined,
    },
    employeeCount: {
      type: Number,
      min: 0,
      default: undefined,
    },
    contactEmail: {
      type: String,
      trim: true,
      maxlength: 160,
      default: undefined,
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 40,
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
  },
  { _id: false },
);

const institutionVerificationReadinessSchema = new Schema<
  NonNullable<IUser['institutionVerification']>['readiness']
>(
  {
    isReadyForReview: {
      type: Boolean,
      default: false,
    },
    requiredDocumentCategories: {
      type: [{ type: String, enum: INSTITUTION_DOCUMENT_CATEGORIES }],
      default: [],
    },
    uploadedDocumentCategories: {
      type: [{ type: String, enum: INSTITUTION_DOCUMENT_CATEGORIES }],
      default: [],
    },
    missingItems: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const institutionVerificationDocumentSchema = new Schema<
  NonNullable<IUser['institutionVerification']>['documents'][number]
>(
  {
    category: {
      type: String,
      enum: INSTITUTION_DOCUMENT_CATEGORIES,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary', 's3'],
      default: undefined,
    },
    storageKey: {
      type: String,
      default: undefined,
    },
    cloudinaryPublicId: {
      type: String,
      default: undefined,
    },
  },
  { _id: true },
);

const institutionVerificationSchema = new Schema<NonNullable<IUser['institutionVerification']>>(
  {
    regulatoryBodies: {
      type: [{ type: String, enum: INSTITUTION_REGULATORY_BODIES }],
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
  },
  { _id: false },
);

const connectedAccountSchema = new Schema<IUser['connectedAccounts']['github']>(
  {
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
  },
  { _id: false },
);

const termsAcceptanceSchema = new Schema<NonNullable<IUser['termsAcceptance']>>(
  {
    version: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    acceptedAt: {
      type: Date,
      required: true,
    },
    sector: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
  },
  { _id: false },
);

const skillSchema = new Schema<IUser['skills'][number]>(
  {
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
  },
  { _id: false },
);

const experienceSchema = new Schema<IUser['experience'][number]>(
  {
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
  },
  { _id: true },
);

const educationSchema = new Schema<IUser['education'][number]>(
  {
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
      enum: ['manual', 'linkedin', 'institution'],
      default: 'manual',
    },
  },
  { _id: true },
);

const certificationSchema = new Schema<IUser['certifications'][number]>(
  {
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
  },
  { _id: true },
);

const portfolioProjectSchema = new Schema<IUser['portfolioProjects'][number]>(
  {
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
  },
  { _id: true },
);

const portfolioServiceSchema = new Schema<IUser['portfolioServices'][number]>(
  {
    icon: {
      type: String,
      trim: true,
      maxlength: 16,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      maxlength: 400,
      default: '',
    },
  },
  { _id: true },
);

const portfolioTestimonialSchema = new Schema<IUser['portfolioTestimonials'][number]>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    text: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { _id: true },
);

const portfolioBlogPostSchema = new Schema<IUser['portfolioBlogPosts'][number]>(
  {
    tag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    tagColor: {
      type: String,
      trim: true,
      maxlength: 32,
      default: '#7c3aed',
    },
    url: {
      type: String,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true },
);

const portfolioContentSchema = new Schema<NonNullable<IUser['portfolioContent']>>(
  {
    heroEyebrow: { type: String, default: '', maxlength: 80 },
    heroTitle: { type: String, default: '', maxlength: 160 },
    heroDescription: { type: String, default: '', maxlength: 500 },
    primaryButtonLabel: { type: String, default: '', maxlength: 60 },
    secondaryButtonLabel: { type: String, default: '', maxlength: 60 },
    statOneLabel: { type: String, default: '', maxlength: 60 },
    statTwoLabel: { type: String, default: '', maxlength: 60 },
    statThreeLabel: { type: String, default: '', maxlength: 60 },
    statFourLabel: { type: String, default: '', maxlength: 60 },
    aboutTitle: { type: String, default: '', maxlength: 80 },
    aboutEmpty: { type: String, default: '', maxlength: 200 },
    experienceTitle: { type: String, default: '', maxlength: 80 },
    experienceEmpty: { type: String, default: '', maxlength: 200 },
    skillsTitle: { type: String, default: '', maxlength: 80 },
    skillsEmpty: { type: String, default: '', maxlength: 200 },
    projectsTitle: { type: String, default: '', maxlength: 80 },
    projectsEmpty: { type: String, default: '', maxlength: 200 },
    educationTitle: { type: String, default: '', maxlength: 80 },
    educationEmpty: { type: String, default: '', maxlength: 200 },
    certificationsTitle: { type: String, default: '', maxlength: 80 },
    certificationsEmpty: { type: String, default: '', maxlength: 200 },
    startupsTitle: { type: String, default: '', maxlength: 80 },
    startupsEmpty: { type: String, default: '', maxlength: 200 },
    linksTitle: { type: String, default: '', maxlength: 80 },
    linksEmpty: { type: String, default: '', maxlength: 200 },
    institutionDetailsTitle: { type: String, default: '', maxlength: 80 },
    institutionDetailsEmpty: { type: String, default: '', maxlength: 200 },
    institutionSpecialtiesTitle: { type: String, default: '', maxlength: 80 },
    institutionSpecialtiesEmpty: { type: String, default: '', maxlength: 200 },
    institutionLocationsTitle: { type: String, default: '', maxlength: 80 },
    institutionLocationsEmpty: { type: String, default: '', maxlength: 200 },
    institutionOutcomesTitle: { type: String, default: '', maxlength: 80 },
    institutionOutcomesEmpty: { type: String, default: '', maxlength: 200 },
    footerNote: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
);

const resumeSchema = new Schema<IUser['resume']>(
  {
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
  },
  { _id: false },
);

const githubLanguageStatSchema = new Schema<IUser['githubStats']['topLanguages'][number]>(
  {
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
  },
  { _id: false },
);

const githubStatsSchema = new Schema<IUser['githubStats']>(
  {
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
  },
  { _id: false },
);

const githubRecentCommitSchema = new Schema<IUser['githubProof']['importedRepos'][number]['recentCommits'][number]>(
  {
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
  },
  { _id: false },
);

const githubImportedRepoSchema = new Schema<IUser['githubProof']['importedRepos'][number]>(
  {
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
  },
  { _id: false },
);

const githubActivityEventSchema = new Schema<IUser['githubProof']['recentActivity'][number]>(
  {
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
  },
  { _id: false },
);

const githubProofSchema = new Schema<IUser['githubProof']>(
  {
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
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
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
      enum: USER_ROLES,
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
    avatarWallpaper: {
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
    twitterUrl: {
      type: String,
      default: null,
    },
    youtubeUrl: {
      type: String,
      default: null,
    },
    behanceUrl: {
      type: String,
      default: null,
    },
    dribbbleUrl: {
      type: String,
      default: null,
    },
    instagramUrl: {
      type: String,
      default: null,
    },
    researchGateUrl: {
      type: String,
      default: null,
    },
    mediumUrl: {
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
      default: createDefaultScoreBreakdown,
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
    termsAcceptance: {
      type: termsAcceptanceSchema,
      default: null,
    },
    institutionToken: {
      type: String,
      default: null,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: new Schema<IUser['connectedAccounts']>(
        {
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
        },
        { _id: false },
      ),
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
    portfolioServices: {
      type: [portfolioServiceSchema],
      default: [],
    },
    portfolioTestimonials: {
      type: [portfolioTestimonialSchema],
      default: [],
    },
    portfolioBlogPosts: {
      type: [portfolioBlogPostSchema],
      default: [],
    },
    portfolioContent: {
      type: portfolioContentSchema,
      default: undefined,
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
      type: [{ type: Schema.Types.ObjectId, ref: 'TeamRequest' }],
      default: [],
    },
    teamRequestsReceived: {
      type: [{ type: Schema.Types.ObjectId, ref: 'TeamRequest' }],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

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

export type UserDocument = HydratedDocument<IUser>;
export const User = model<IUser>('User', userSchema);
