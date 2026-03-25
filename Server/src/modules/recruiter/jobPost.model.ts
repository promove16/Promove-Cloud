import { Schema, Types, model } from 'mongoose';

export type JobType = 'Full-time' | 'Internship' | 'Contract' | 'Part-time';

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
