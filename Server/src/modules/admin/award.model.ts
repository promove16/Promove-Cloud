import { Schema, Types, model } from 'mongoose';

export type AwardStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface IAdminAward {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  title: string;
  description: string;
  status: AwardStatus;
  submittedAt: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const awardSchema = new Schema<IAdminAward>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'rejected'],
      default: 'submitted',
    },
    submittedAt: { type: Date, default: () => new Date() },
    adminReviewedAt: { type: Date, default: undefined },
    adminReviewedBy: { type: Schema.Types.ObjectId, default: undefined },
    adminNotes: { type: String, default: undefined },
  },
  { timestamps: true },
);

awardSchema.index({ studentId: 1, status: 1 });

export const AdminAward = model<IAdminAward>('AdminAward', awardSchema);
