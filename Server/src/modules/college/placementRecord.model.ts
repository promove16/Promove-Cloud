import { Schema, Types, model } from 'mongoose';

export type PlacementStatus =
  | 'Discovered'
  | 'Shortlisted'
  | 'Hired'
  | 'Rejected'
  | 'In Progress';

export interface IPlacementRecord {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  collegeId: Types.ObjectId;
  recruiterId?: Types.ObjectId;
  companyName?: string;
  status: PlacementStatus;
  innovationScoreAtTime: number;
  updatedAt: Date;
  createdAt: Date;
}

const placementRecordSchema = new Schema<IPlacementRecord>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    collegeId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    recruiterId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    companyName: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ['Discovered', 'Shortlisted', 'Hired', 'Rejected', 'In Progress'],
      required: true,
      default: 'Discovered',
    },
    innovationScoreAtTime: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

placementRecordSchema.index({ collegeId: 1, status: 1 });
placementRecordSchema.index({ studentId: 1 });
placementRecordSchema.index({ recruiterId: 1 });

export const PlacementRecord = model<IPlacementRecord>(
  'PlacementRecord',
  placementRecordSchema,
);
