import { Schema, model } from 'mongoose';
import { AGREEMENT_STATUSES, IAgreement } from './agreement.types';

const agreementSchema = new Schema<IAgreement>(
  {
    bidId: {
      type: Schema.Types.ObjectId,
      ref: 'Bid',
      required: true,
      unique: true,
      index: true,
    },
    startupId: { type: Schema.Types.ObjectId, ref: 'Startup', required: true, index: true },
    investorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    founderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Investment', default: undefined },
    agreementNumber: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: AGREEMENT_STATUSES,
      default: 'generated',
      required: true,
      index: true,
    },
    terms: {
      bidType: { type: String, enum: ['penny', 'sole'], required: true },
      amount: { type: Number, required: true, min: 0 },
      equity: { type: Number, required: true, min: 0, max: 100 },
      investorRole: {
        type: String,
        enum: ['shareholder', 'director', 'observer'],
        required: true,
      },
      startupName: { type: String, required: true },
      founderName: { type: String, required: true },
      investorName: { type: String, required: true },
    },
    bodyText: { type: String, required: true },
    acknowledgedByInvestorAt: { type: Date, default: undefined },
    acknowledgedByFounderAt: { type: Date, default: undefined },
    voidedAt: { type: Date, default: undefined },
    voidReason: { type: String, default: undefined },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

agreementSchema.index({ startupId: 1, status: 1, createdAt: -1 });

export const Agreement = model<IAgreement>('Agreement', agreementSchema);
