import { Schema, model, Document, Types } from 'mongoose';
import { TemporaryMemoryMode, DEFAULT_TEMPORARY_MEMORY_MODE } from '../temporaryMemory/temporaryMemory.constants';

export type QueryType = 'project_mentor' | 'investor' | 'recruiter' | 'general';

export interface IDirectMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  attachmentName?: string;
  attachmentPublicId?: string;
  /** ISO string for interview scheduling messages */
  scheduledAt?: Date;
  meetLink?: string;
  messageType: 'text' | 'interview_request';
  queryType?: QueryType;
  memoryMode: TemporaryMemoryMode;
  expiresAt?: Date;
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
    attachmentPublicId: { type: String, default: undefined },
    scheduledAt: { type: Date, default: undefined },
    meetLink: { type: String, default: undefined },
    messageType: { type: String, enum: ['text', 'interview_request'], default: 'text' },
    queryType: { type: String, enum: ['project_mentor', 'investor', 'recruiter', 'general'], default: 'general' },
    memoryMode: {
      type: String,
      enum: ['standard', 'temporary'],
      default: DEFAULT_TEMPORARY_MEMORY_MODE,
    },
    expiresAt: { type: Date, default: undefined },
    readAt: { type: Date, default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

// Index for fetching conversation between two users
directMessageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 });
directMessageSchema.index({ recipientId: 1, sentAt: -1 });
directMessageSchema.index({ memoryMode: 1, expiresAt: 1 });

export const DirectMessage = model<IDirectMessage>('DirectMessage', directMessageSchema);
