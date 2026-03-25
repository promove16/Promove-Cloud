import { Schema, Types, model } from 'mongoose';

export type CampusDriveType = 'Placement Drive' | 'Internship Drive' | 'Hackathon';

export interface ICampusDrive {
  _id: Types.ObjectId;
  recruiterId: Types.ObjectId;
  collegeId: Types.ObjectId;
  title: string;
  description: string;
  type: CampusDriveType;
  scheduledAt: Date;
  minimumInnovationScore: number;
  registeredStudents: Array<{
    studentId: Types.ObjectId;
    registeredAt: Date;
    submissionScore?: number;
  }>;
  isActive: boolean;
  createdAt: Date;
}

const campusDriveSchema = new Schema<ICampusDrive>(
  {
    recruiterId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    collegeId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    type: {
      type: String,
      enum: ['Placement Drive', 'Internship Drive', 'Hackathon'],
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    minimumInnovationScore: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    registeredStudents: {
      type: [
        new Schema(
          {
            studentId: { type: Schema.Types.ObjectId, required: true },
            registeredAt: { type: Date, required: true },
            submissionScore: { type: Number, default: undefined },
          },
          { _id: false },
        ),
      ],
      default: [],
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

campusDriveSchema.index({ recruiterId: 1 });
campusDriveSchema.index({ collegeId: 1, isActive: 1 });

export const CampusDrive = model<ICampusDrive>('CampusDrive', campusDriveSchema);
