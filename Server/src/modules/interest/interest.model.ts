import { Schema, model } from 'mongoose';
import { IInterest, INTEREST_STATUSES } from './interest.types';

const interestSchema = new Schema<IInterest>(
  {
    startupId: {
      type: Schema.Types.ObjectId,
      ref: 'Startup',
      required: true,
      index: true,
    },
    investorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: INTEREST_STATUSES,
      default: 'active',
      required: true,
      index: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: undefined,
    },
    withdrawnAt: { type: Date, default: undefined },
  },
  { timestamps: true },
);

// One active interest per (startup, investor). A withdrawn record can coexist
// with a new active one because we filter by status, but practically we soft
// resurrect via update — partial unique index keeps that invariant.
interestSchema.index(
  { startupId: 1, investorId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
interestSchema.index({ startupId: 1, status: 1, createdAt: -1 });
interestSchema.index({ investorId: 1, status: 1, createdAt: -1 });

export const Interest = model<IInterest>('Interest', interestSchema);
