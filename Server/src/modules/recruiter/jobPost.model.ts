import { Schema, Types, model } from 'mongoose';

export type JobType = 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
export type JobWorkMode = 'On-site' | 'Hybrid' | 'Remote';

export interface IJobPost {
  _id: Types.ObjectId;
  recruiterId: Types.ObjectId;
  title: string;
  company: string;
  description: string;
  domain: string;
  minimumInnovationScore: number;
  type: JobType;
  location: string;
  workMode?: JobWorkMode;
  salaryExpectation?: string;
  experienceLevel?: string;
  openings?: number;
  companyOverview?: string;
  roleSummary?: string;
  keyResponsibilities: string[];
  requirements: string[];
  benefits: string[];
  applicationSteps: string[];
  isActive: boolean;
  applicantIds: Types.ObjectId[];
  shortlistedIds: Types.ObjectId[];
  createdAt: Date;
  expiresAt?: Date;
}

const jobPostSchema = new Schema<IJobPost>(
  {
    recruiterId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    minimumInnovationScore: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ['Full-time', 'Internship', 'Contract', 'Part-time'],
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    workMode: {
      type: String,
      enum: ['On-site', 'Hybrid', 'Remote'],
      default: undefined,
    },
    salaryExpectation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: undefined,
    },
    experienceLevel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: undefined,
    },
    openings: {
      type: Number,
      min: 1,
      default: undefined,
    },
    companyOverview: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: undefined,
    },
    roleSummary: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: undefined,
    },
    keyResponsibilities: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    applicationSteps: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    applicantIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    shortlistedIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

jobPostSchema.index({ recruiterId: 1, isActive: 1 });
jobPostSchema.index({ minimumInnovationScore: 1 });

export const JobPost = model<IJobPost>('JobPost', jobPostSchema);
