import { Schema, model } from 'mongoose';
import { IProblemSubmission } from './problem.types';

const problemSubmissionSchema = new Schema<IProblemSubmission>(
  {
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamMemberIds: {
      type: [Schema.Types.ObjectId],
      required: true,
      default: [],
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestNote: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    reviewStatus: {
      type: String,
      enum: ['review_requested', 'changes_requested', 'approved'],
      required: true,
      default: 'review_requested',
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    adminReviewedAt: {
      type: Date,
      default: undefined,
    },
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    adminNotes: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 500,
    },
    pointsAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

problemSubmissionSchema.index({ problemId: 1, workspaceId: 1 }, { unique: true });
problemSubmissionSchema.index({ problemId: 1, reviewStatus: 1, pointsAwarded: -1 });
problemSubmissionSchema.index({ teamMemberIds: 1 });

export const ProblemSubmission = model<IProblemSubmission>(
  'ProblemSubmission',
  problemSubmissionSchema,
);
