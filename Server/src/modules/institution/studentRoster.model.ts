import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type StudentRosterSource = 'manual' | 'csv' | 'xlsx';
export type StudentRosterStatus =
  | 'invited'
  | 'registered_pending'
  | 'verified'
  | 'rejected';

export interface IInstitutionStudentRosterEntry {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE;
  createdBy: Types.ObjectId;
  displayName: string;
  email: string;
  gradeOrProgram?: string;
  rollNumber?: string;
  notes?: string;
  source: StudentRosterSource;
  status: StudentRosterStatus;
  linkedUserId?: Types.ObjectId | null;
  registeredAt?: Date;
  reviewedAt?: Date;
  importedFileName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const institutionStudentRosterEntrySchema = new Schema<IInstitutionStudentRosterEntry>(
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
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    gradeOrProgram: {
      type: String,
      trim: true,
      maxlength: 120,
      default: undefined,
    },
    rollNumber: {
      type: String,
      trim: true,
      maxlength: 80,
      default: undefined,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: undefined,
    },
    source: {
      type: String,
      enum: ['manual', 'csv', 'xlsx'],
      default: 'manual',
      required: true,
    },
    status: {
      type: String,
      enum: ['invited', 'registered_pending', 'verified', 'rejected'],
      default: 'invited',
      required: true,
    },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    registeredAt: {
      type: Date,
      default: undefined,
    },
    reviewedAt: {
      type: Date,
      default: undefined,
    },
    importedFileName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

institutionStudentRosterEntrySchema.index({ institutionId: 1, email: 1 }, { unique: true });
institutionStudentRosterEntrySchema.index({ institutionId: 1, status: 1, createdAt: -1 });

export type InstitutionStudentRosterEntryDocument =
  HydratedDocument<IInstitutionStudentRosterEntry>;
export const InstitutionStudentRosterEntry = model<IInstitutionStudentRosterEntry>(
  'InstitutionStudentRosterEntry',
  institutionStudentRosterEntrySchema,
);
