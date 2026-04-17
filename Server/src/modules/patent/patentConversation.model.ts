import { Schema, model, Document, Types } from 'mongoose';

export interface IPatentConversationMessage extends Document {
  patentRequestId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'student' | 'admin';
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'pdf' | 'image';
  attachmentName?: string;
  readAt?: Date;
  sentAt: Date;
}

const patentConversationMessageSchema = new Schema<IPatentConversationMessage>(
  {
    patentRequestId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderRole: { type: String, enum: ['student', 'admin'], required: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: { type: String, enum: ['pdf', 'image'], default: undefined },
    attachmentName: { type: String, default: undefined },
    readAt: { type: Date, default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

patentConversationMessageSchema.index({ patentRequestId: 1, sentAt: -1 });

export const PatentConversationMessage = model<IPatentConversationMessage>(
  'PatentConversationMessage',
  patentConversationMessageSchema,
);
