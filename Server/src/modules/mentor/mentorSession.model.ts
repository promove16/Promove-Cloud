import { Schema, Types, model } from 'mongoose';

export type MentorSessionStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface IMentorSession {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink?: string;
  status: MentorSessionStatus;
  mentorNotes?: string;
  studentFeedback?: string;
  // Session token — student releases points to mentor by ending the session
  tokenReleased: boolean;
  tokenReleasedAt?: Date;
  sessionPointsAwarded: boolean;
  createdAt: Date;
}

const mentorSessionSchema = new Schema<IMentorSession>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
    },
    meetLink: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      required: true,
      default: 'Scheduled',
    },
    mentorNotes: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 4000,
    },
    studentFeedback: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 4000,
    },
    tokenReleased: {
      type: Boolean,
      default: false,
    },
    tokenReleasedAt: {
      type: Date,
      default: undefined,
    },
    sessionPointsAwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

mentorSessionSchema.index({ mentorId: 1, status: 1 });
mentorSessionSchema.index({ studentId: 1 });

export const MentorSession = model<IMentorSession>('MentorSession', mentorSessionSchema);
