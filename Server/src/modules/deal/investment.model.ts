import { Schema, model } from 'mongoose';
import { IInvestment } from './investment.types';

const investmentSchema = new Schema<IInvestment>(
  {
    startupId: {
      type: Schema.Types.ObjectId,
      ref: 'Startup',
      required: true,
    },
    investorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediatorLabel: {
      type: String,
      default: 'ProMove',
      trim: true,
    },
    requestOrigin: {
      type: String,
      enum: ['investor', 'student'],
      default: 'investor',
      required: true,
    },
    mediationStatus: {
      type: String,
      enum: ['intake', 'under_review', 'approved'],
      default: 'intake',
      required: true,
    },
    investorType: {
      type: String,
      enum: ['penny', 'sole'],
      required: true,
    },
    amountINR: {
      type: Number,
      required: true,
      min: 20000,
    },
    proposedAmountINR: {
      type: Number,
      default: undefined,
      min: 20000,
    },
    equityPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    proposedEquityPercent: {
      type: Number,
      default: undefined,
      min: 0,
      max: 100,
    },
    sharesAllocated: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockDetails: {
      shareClassLabel: {
        type: String,
        default: 'Common Equity',
        trim: true,
      },
      sharePriceInr: {
        type: Number,
        default: 0,
        min: 0,
      },
      transferValueInr: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalSharesConsidered: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    stockTransfer: {
      status: {
        type: String,
        enum: ['not_started', 'pending_review', 'under_review', 'approved'],
        default: 'not_started',
        required: true,
      },
      requestedAt: {
        type: Date,
        default: undefined,
      },
      requestedByRole: {
        type: String,
        enum: ['investor', 'student', 'admin'],
        default: undefined,
      },
      requestSummary: {
        type: String,
        default: undefined,
        trim: true,
      },
      reviewNotes: {
        type: String,
        default: undefined,
        trim: true,
      },
      reviewedAt: {
        type: Date,
        default: undefined,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: undefined,
      },
    },
    royalty: {
      promovePercentage: {
        type: Number,
        default: 2.5,
        min: 0,
        max: 100,
      },
      promoveAmountINR: {
        type: Number,
        default: 0,
        min: 0,
      },
      status: {
        type: String,
        enum: ['pending', 'invoiced', 'received'],
        default: 'pending',
        required: true,
      },
      settledAt: {
        type: Date,
        default: undefined,
      },
    },
    investorRole: {
      type: String,
      enum: ['shareholder', 'director', 'observer'],
      required: true,
    },
    votingWeight: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    canVeto: {
      type: Boolean,
      default: false,
    },
    canAccessFinancials: {
      type: Boolean,
      default: false,
    },
    canRequestUpdates: {
      type: Boolean,
      default: true,
    },
    stage: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1,
      required: true,
    },
    fundTransferInitiatedAt: {
      type: Date,
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
      ref: 'User',
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

investmentSchema.index({ startupId: 1, investorType: 1 });
investmentSchema.index({ investorId: 1, stage: 1 });
investmentSchema.index({ startupId: 1, investorId: 1 }, { unique: true });
investmentSchema.index({ studentId: 1 });
investmentSchema.index({ status: 1 });

export const Investment = model<IInvestment>('Investment', investmentSchema);
