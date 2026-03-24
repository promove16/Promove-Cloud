import { Schema, model } from 'mongoose';
import { IScoreEvent } from './score.types';

const scoreEventSchema = new Schema<IScoreEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    trigger: {
      type: String,
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
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

scoreEventSchema.index({ userId: 1, createdAt: -1 });

export const ScoreEvent = model<IScoreEvent>('ScoreEvent', scoreEventSchema);
