import { Schema, Types, model } from 'mongoose';
import { CreateMentorFeedbackInput } from './mentor.types';

interface IMentorFeedback extends Omit<CreateMentorFeedbackInput, 'studentId' | 'workspaceId'> {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mentorFeedbackSchema = new Schema<IMentorFeedback>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    feedbackText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  },
);

mentorFeedbackSchema.index({ mentorId: 1, studentId: 1, createdAt: -1 });

export const MentorFeedback = model<IMentorFeedback>('MentorFeedback', mentorFeedbackSchema);
