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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

mentorSessionSchema.index({ mentorId: 1, status: 1 });
mentorSessionSchema.index({ studentId: 1 });

export const MentorSession = model<IMentorSession>('MentorSession', mentorSessionSchema);
