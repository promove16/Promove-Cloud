import { Schema, model, Document, Types } from 'mongoose';

export const REPORT_REASONS = [
  'harassment',
  'spam',
  'inappropriate_content',
  'fake_profile',
  'privacy_violation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface IUserReport extends Document {
  institutionId?: Types.ObjectId | null;
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

const userReportSchema = new Schema<IUserReport>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reporterId: { type: Schema.Types.ObjectId, required: true, index: true },
    reportedUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: {
      type: String,
      required: true,
      enum: REPORT_REASONS,
    },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

userReportSchema.index({ reportedUserId: 1, status: 1 });
userReportSchema.index({ institutionId: 1, status: 1, createdAt: -1 });

export const UserReport = model<IUserReport>('UserReport', userReportSchema);
