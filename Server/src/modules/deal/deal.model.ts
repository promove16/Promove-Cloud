import { Schema, Types, model } from 'mongoose';
import { IDeal } from './deal.types';

const dealSchema = new Schema<IDeal>(
  {
    investorId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    startupId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    stage: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4],
      default: 1,
    },
    amountINR: {
      type: Number,
      default: undefined,
      min: 0,
    },
    fundTransferInitiatedAt: {
      type: Date,
      default: undefined,
    },
    equityPercent: {
      type: Number,
      default: undefined,
      min: 0,
      max: 100,
    },
    investorRole: {
      type: String,
      enum: ['Shareholder', 'Director', 'Co-Founder'],
      default: undefined,
    },
    adminApprovalRequired: {
      type: Boolean,
      default: false,
    },
    adminApprovedAt: {
      type: Date,
      default: undefined,
    },
    adminApprovedBy: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    closedAt: {
      type: Date,
      default: undefined,
    },
    innovationScoreSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'cancelled'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

dealSchema.index({ investorId: 1, stage: 1 });
dealSchema.index({ startupId: 1 });
dealSchema.index({ studentId: 1 });
dealSchema.index({ status: 1 });

export const Deal = model<IDeal>('Deal', dealSchema);
