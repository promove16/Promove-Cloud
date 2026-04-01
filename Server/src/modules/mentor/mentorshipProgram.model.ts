import { Schema, Types, model } from 'mongoose';

export type InstitutionMentorshipProgramStatus = 'Pending' | 'Assigned' | 'Rejected';
export type InstitutionMentorshipDeliveryMode = 'Online' | 'Offline';
export type InstitutionMentorshipPlatform = 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
export type InstitutionMentorshipType = 'school' | 'college';

export interface IInstitutionMentorshipProgram {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: InstitutionMentorshipType;
  requestedBy: Types.ObjectId;
  mentorId?: Types.ObjectId;
  title: string;
  objective: string;
  preferredDate: Date;
  scheduledAt?: Date;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: InstitutionMentorshipDeliveryMode;
  platform: InstitutionMentorshipPlatform;
  meetingLink?: string;
  venue?: string;
  preferredExpertise?: string;
  adminNotes?: string;
  rejectionReason?: string;
  status: InstitutionMentorshipProgramStatus;
  createdAt: Date;
  updatedAt: Date;
}

const institutionMentorshipProgramSchema = new Schema<IInstitutionMentorshipProgram>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    institutionType: {
      type: String,
      enum: ['school', 'college'],
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    mentorId: {
      type: Schema.Types.ObjectId,
      default: undefined,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    objective: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    preferredDate: {
      type: Date,
      required: true,
    },
    scheduledAt: {
      type: Date,
      default: undefined,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 30,
      max: 480,
    },
    expectedParticipants: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
    },
    deliveryMode: {
      type: String,
      enum: ['Online', 'Offline'],
      required: true,
    },
    platform: {
      type: String,
      enum: ['Google Meet', 'Microsoft Teams', 'Zoom', 'Offline'],
      required: true,
    },
    meetingLink: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 500,
    },
    venue: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 240,
    },
    preferredExpertise: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 160,
    },
    adminNotes: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 1000,
    },
    rejectionReason: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'Rejected'],
      required: true,
      default: 'Pending',
    },
  },
  { timestamps: true },
);

institutionMentorshipProgramSchema.index({ institutionId: 1, createdAt: -1 });
institutionMentorshipProgramSchema.index({ status: 1, createdAt: -1 });
institutionMentorshipProgramSchema.index({ mentorId: 1, scheduledAt: 1 });

export const InstitutionMentorshipProgram = model<IInstitutionMentorshipProgram>(
  'InstitutionMentorshipProgram',
  institutionMentorshipProgramSchema,
);
