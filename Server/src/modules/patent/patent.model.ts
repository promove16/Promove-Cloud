import { Schema, model } from 'mongoose';
import { IPatent } from './patent.types';

const patentSchema = new Schema<IPatent>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, default: undefined },
    projectTitle: { type: String, required: true, trim: true },
    questionnaire: {
      whatIsYourInnovation: { type: String, required: true },
      noveltyExplanation: { type: String, required: true },
      technicalDetails: { type: String, required: true },
      marketUseCase: { type: String, required: true },
      priorArtAwareness: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'rejected'],
      default: 'submitted',
    },
    submittedAt: { type: Date, default: () => new Date() },
    adminReviewedAt: { type: Date, default: undefined },
    adminReviewedBy: { type: Schema.Types.ObjectId, default: undefined },
    adminNotes: { type: String, default: undefined },
    scoreAwarded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

patentSchema.index({ studentId: 1, status: 1 });

export const Patent = model<IPatent>('Patent', patentSchema);
