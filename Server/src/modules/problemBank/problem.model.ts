import { Schema, model } from 'mongoose';
import { IProblem } from './problem.types';

const submissionConfigSchema = new Schema<IProblem['submissionConfig']>(
  {
    allowDocuments: { type: Boolean, default: true },
    allowImages: { type: Boolean, default: true },
    allowGithubRepos: { type: Boolean, default: true },
    allowCodeSnippets: { type: Boolean, default: true },
    maxFileSizeMb: { type: Number, default: 10, min: 1, max: 25 },
    maxRepoLinks: { type: Number, default: 3, min: 0, max: 10 },
    maxCodeSnippets: { type: Number, default: 5, min: 0, max: 20 },
    codeExecutionAllowed: { type: Boolean, default: false },
  },
  { _id: false },
);

const problemSchema = new Schema<IProblem>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Agriculture', 'Technology', 'Healthcare', 'Education', 'Environment', 'Rural Development', 'Other'],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['Easy', 'Medium', 'Hard'],
    },
    domain: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    postedBy: { type: String, required: true, trim: true },
    sponsorName: { type: String, default: undefined, trim: true, maxlength: 160 },
    geography: { type: String, default: undefined, trim: true, maxlength: 160 },
    targetBeneficiaries: { type: [String], default: [] },
    impactGoal: { type: String, default: undefined, trim: true, maxlength: 500 },
    expectedOutcome: { type: String, default: undefined, trim: true, maxlength: 500 },
    deliverables: { type: [String], default: [] },
    acceptanceCriteria: { type: [String], default: [] },
    constraints: { type: [String], default: [] },
    resourceLinks: { type: [String], default: [] },
    securityNotice: {
      type: String,
      default:
        'Upload only project-safe evidence. Do not share secrets, credentials, private keys, personal data, or production database exports.',
      trim: true,
      maxlength: 500,
    },
    publicationStatus: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    claimStatus: {
      type: String,
      enum: ['open', 'claimed', 'completed'],
      default: 'open',
      index: true,
    },
    maxClaims: {
      type: Number,
      default: 1,
      min: 1,
      max: 1,
    },
    submissionConfig: {
      type: submissionConfigSchema,
      default: () => ({
        allowDocuments: true,
        allowImages: true,
        allowGithubRepos: true,
        allowCodeSnippets: true,
        maxFileSizeMb: 10,
        maxRepoLinks: 3,
        maxCodeSnippets: 5,
        codeExecutionAllowed: false,
      }),
    },
    createdByAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    claimedBy: { type: Schema.Types.ObjectId, default: undefined, index: true },
    claimedAt: { type: Date, default: undefined },
  },
  { timestamps: true },
);

problemSchema.index({ category: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ isVerified: 1 });
problemSchema.index({ publicationStatus: 1, claimStatus: 1, createdAt: -1 });
problemSchema.index({ title: 'text', description: 'text' });

export const Problem = model<IProblem>('Problem', problemSchema);
