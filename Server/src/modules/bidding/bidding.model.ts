import { Schema, model } from 'mongoose';
import { IBid, ICounterOfferEntry, BID_STATUSES, BID_TYPES } from './bidding.types';

const counterOfferEntrySchema = new Schema<ICounterOfferEntry>(
  {
    by: { type: String, enum: ['founder', 'investor'], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    equity: { type: Number, required: true, min: 0, max: 100 },
    message: { type: String, trim: true, maxlength: 2000, default: undefined },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const bidSchema = new Schema<IBid>(
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
      enum: BID_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    bidType: {
      type: String,
      enum: BID_TYPES,
      required: true,
    },
    proposedAmount: {
      type: Number,
      required: true,
      min: 20000,
    },
    proposedEquity: {
      type: Number,
      required: true,
      min: 0.01,
      max: 100,
    },
    counterAmount: {
      type: Number,
      default: undefined,
      min: 20000,
    },
    counterEquity: {
      type: Number,
      default: undefined,
      min: 0.01,
      max: 100,
    },
    finalAmount: {
      type: Number,
      default: undefined,
      min: 20000,
    },
    finalEquity: {
      type: Number,
      default: undefined,
      min: 0.01,
      max: 100,
    },
    coverLetter: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: undefined,
    },
    investorRole: {
      type: String,
      enum: ['shareholder', 'director', 'observer'],
      default: 'shareholder',
    },
    expiresAt: {
      type: Date,
      default: undefined,
    },
    viewedAt: { type: Date, default: undefined },
    acceptedAt: { type: Date, default: undefined },
    rejectedAt: { type: Date, default: undefined },
    expiredAt: { type: Date, default: undefined },
    closedAt: { type: Date, default: undefined },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: undefined,
    },
    counterOfferHistory: { type: [counterOfferEntrySchema], default: [] },
    isRead: { type: Boolean, default: false },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Investment',
      default: undefined,
    },
  },
  { timestamps: true },
);

bidSchema.index({ startupId: 1, status: 1 });
bidSchema.index({ investorId: 1, status: 1 });
bidSchema.index({ founderId: 1, status: 1 });
bidSchema.index({ status: 1, expiresAt: 1 });
bidSchema.index({ createdAt: -1 });

export const Bid = model<IBid>('Bid', bidSchema);
