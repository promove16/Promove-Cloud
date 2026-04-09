import { Schema, model } from 'mongoose';
import { IEvent } from './event.types';

const participantSchema = new Schema<IEvent['participants'][number]>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    submissionScore: {
      type: Number,
      default: undefined,
      min: 0,
      max: 100,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { _id: false },
);

const rankingSchema = new Schema<IEvent['rankings'][number]>(
  {
    rank: {
      type: Number,
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    compositeScore: {
      type: Number,
      required: true,
    },
    innovationScore: {
      type: Number,
      required: true,
    },
    submissionScore: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const eventSchema = new Schema<IEvent>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    type: {
      type: String,
      enum: ['Industry Connect Session', 'Placement Hackathon', 'Innovation Drive', 'Other'],
      required: true,
    },
    category: {
      type: String,
      enum: ['internal', 'hiring'],
      default: 'internal',
      required: true,
    },
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    linkedJobId: {
      type: Schema.Types.ObjectId,
      ref: 'JobPost',
      default: undefined,
    },
    minimumInnovationScore: {
      type: Number,
      min: 0,
      default: undefined,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    rankings: {
      type: [rankingSchema],
      default: [],
    },
    rankingsComputedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ institutionId: 1, scheduledAt: -1 });
eventSchema.index({ recruiterId: 1, category: 1 });

export const Event = model<IEvent>('Event', eventSchema);
