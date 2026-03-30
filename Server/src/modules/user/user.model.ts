import { HydratedDocument, Schema, model } from 'mongoose';
import { USER_ROLES } from '../../types/roles.types';
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

const defaultScoreBreakdown = () => ({
  problemsClaimed: 0,
  skillsCompleted: 0,
  progressUploads: 0,
  patentsSubmitted: 0,
  patentsApproved: 0,
  mvpsVerified: 0,
  marketReadyVerified: 0,
  startupsLaunched: 0,
  awardsApproved: 0,
});

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

const oauthAccountSchema = new Schema<IUser['connectedAccounts']['github']>(
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
      enum: ['manual', 'linkedin'],
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
      default: defaultScoreBreakdown,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    institutionProfile: {
      type: institutionProfileSchema,
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
            type: oauthAccountSchema,
            default: () => ({
              userId: null,
              username: null,
              accessToken: null,
              connectedAt: null,
              lastSyncedAt: null,
            }),
          },
          google: {
            type: oauthAccountSchema,
            default: () => ({
              userId: null,
              username: null,
              accessToken: null,
              connectedAt: null,
              lastSyncedAt: null,
            }),
          },
          linkedin: {
            type: oauthAccountSchema,
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
