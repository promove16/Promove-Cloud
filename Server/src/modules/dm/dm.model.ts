import { Schema, model, Document, Types } from 'mongoose';

export interface IDirectMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  /** ISO string for interview scheduling messages */
  scheduledAt?: Date;
  meetLink?: string;
  messageType: 'text' | 'interview_request';
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
    scheduledAt: { type: Date, default: undefined },
    meetLink: { type: String, default: undefined },
    messageType: { type: String, enum: ['text', 'interview_request'], default: 'text' },
    readAt: { type: Date, default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

// Index for fetching conversation between two users
directMessageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 });
directMessageSchema.index({ recipientId: 1, sentAt: -1 });

export const DirectMessage = model<IDirectMessage>('DirectMessage', directMessageSchema);
