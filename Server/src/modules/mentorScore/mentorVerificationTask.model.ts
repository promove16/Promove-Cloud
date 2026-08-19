import { Schema, model } from 'mongoose';
import { IMentorVerificationTask } from './mentorScore.types';

const TASK_TYPES = [
  'lab_sync',
  'curriculum_pdf',
  'class_photo',
  'industry_session',
  'prototype_velocity',
  'demo_day',
  'outcome_bonus',
] as const;

const mentorVerificationTaskSchema = new Schema<IMentorVerificationTask>(
  {
    type: {
      type: String,
      enum: TASK_TYPES,
      required: true,
    },
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    submissionUrls: {
      type: [String],
      default: [],
    },
    submissionData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    pointsToAward: {
      type: Number,
      required: true,
      min: 0,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    reviewedAt: {
      type: Date,
      default: undefined,
    },
    rejectionNote: {
      type: String,
      maxlength: 500,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

mentorVerificationTaskSchema.index({ status: 1, createdAt: -1 });
mentorVerificationTaskSchema.index({ type: 1, status: 1 });
mentorVerificationTaskSchema.index({ mentorId: 1, type: 1 });

export const MentorVerificationTask = model<IMentorVerificationTask>(
  'MentorVerificationTask',
  mentorVerificationTaskSchema,
);
