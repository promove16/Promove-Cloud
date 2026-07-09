import { Schema, model } from 'mongoose';
import { IMentorScoreEvent, MentorScoreTrigger } from './mentorScore.types';

const mentorScoreEventSchema = new Schema<IMentorScoreEvent>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trigger: {
      type: String,
      enum: Object.values(MentorScoreTrigger),
      required: true,
    },
    delta: {
      type: Number,
      required: true,
    },
    scoreAfter: {
      type: Number,
      required: true,
    },
    phase: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    idempotencyKey: {
      type: String,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

mentorScoreEventSchema.index({ mentorId: 1, createdAt: -1 });
mentorScoreEventSchema.index(
  { mentorId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
mentorScoreEventSchema.index({ mentorId: 1, trigger: 1 });

export const MentorScoreEvent = model<IMentorScoreEvent>('MentorScoreEvent', mentorScoreEventSchema);
