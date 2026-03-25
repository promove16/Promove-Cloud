import { Schema, Types, model } from 'mongoose';

export type RelevanceBridgeType =
  | 'HR_SHORTLIST'
  | 'ACTIVE_APPLICATION'
  | 'SCORE_MATCH'
  | 'LAUNCH_TRIGGER';

export interface IRelevanceBridge {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  recruiterId: Types.ObjectId;
  bridgeType: RelevanceBridgeType;
  isActive: boolean;
  createdAt: Date;
}

const relevanceBridgeSchema = new Schema<IRelevanceBridge>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    recruiterId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    bridgeType: {
      type: String,
      enum: ['HR_SHORTLIST', 'ACTIVE_APPLICATION', 'SCORE_MATCH', 'LAUNCH_TRIGGER'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

relevanceBridgeSchema.index({ studentId: 1, recruiterId: 1 }, { unique: true });
relevanceBridgeSchema.index({ recruiterId: 1, isActive: 1 });
relevanceBridgeSchema.index({ studentId: 1, isActive: 1 });

export const RelevanceBridge = model<IRelevanceBridge>('RelevanceBridge', relevanceBridgeSchema);
