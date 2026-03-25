import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export interface IStudentAccessToken {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE;
  createdBy: Types.ObjectId;
  label?: string;
  token: string;
  isActive: boolean;
  usageCount: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentAccessTokenSchema = new Schema<IStudentAccessToken>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institutionRole: {
      type: String,
      enum: [UserRole.SCHOOL, UserRole.COLLEGE],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
      default: undefined,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

studentAccessTokenSchema.index({ institutionId: 1, isActive: 1, createdAt: -1 });

export type StudentAccessTokenDocument = HydratedDocument<IStudentAccessToken>;
export const StudentAccessToken = model<IStudentAccessToken>(
  'StudentAccessToken',
  studentAccessTokenSchema,
);
