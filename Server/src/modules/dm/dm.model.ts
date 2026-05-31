import { Schema, model, Document, Types } from 'mongoose';

export type QueryType =
  | 'project_mentor'
  | 'project_join'
  | 'investor'
  | 'recruiter'
  | 'hiring_event'
  | 'mentorship_program'
  | 'general';

export interface IDirectMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  attachmentName?: string;
  attachmentStorageProvider?: 's3' | 'cloudinary';
  attachmentStorageKey?: string;
  /** ISO string for interview scheduling messages */
  scheduledAt?: Date;
  meetLink?: string;
  messageType: 'text' | 'interview_request' | 'funding_request';
  queryType?: QueryType;
  /** Set on investor pitch / funding-request messages so the recipient can act on the startup directly. */
  startupId?: Types.ObjectId;
  readAt?: Date;
  sentAt: Date;
}

const directMessageSchema = new Schema<IDirectMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: { type: String, enum: ['image', 'pdf'], default: undefined },
    attachmentName: { type: String, default: undefined },
    attachmentStorageProvider: { type: String, enum: ['s3', 'cloudinary'], default: undefined },
    attachmentStorageKey: { type: String, default: undefined, trim: true },
    scheduledAt: { type: Date, default: undefined },
    meetLink: { type: String, default: undefined },
    messageType: { type: String, enum: ['text', 'interview_request', 'funding_request'], default: 'text' },
    queryType: {
      type: String,
      enum: ['project_mentor', 'project_join', 'investor', 'recruiter', 'hiring_event', 'mentorship_program', 'general'],
      default: 'general',
    },
    startupId: { type: Schema.Types.ObjectId, ref: 'Startup', default: undefined },
    readAt: { type: Date, default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

// Index for fetching conversation between two users
directMessageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 });
directMessageSchema.index({ recipientId: 1, sentAt: -1 });

export const DirectMessage = model<IDirectMessage>('DirectMessage', directMessageSchema);
