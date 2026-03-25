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
      default: undefined,
      maxlength: 500,
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
      enum: ['self_registered', 'institution_token'],
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
    lastLogin: {
      type: Date,
      default: undefined,
    },
    discoverableToRecruiters: {
      type: Boolean,
      default: false,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    institutionProfile: {
      type: institutionProfileSchema,
      default: undefined,
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
  },
  {
    timestamps: true,
  },
);

userSchema.index({ role: 1, innovationScore: -1 });
userSchema.index({ institutionId: 1 });
userSchema.index({ role: 1, isActive: 1 });

export type UserDocument = HydratedDocument<IUser>;
export const User = model<IUser>('User', userSchema);
