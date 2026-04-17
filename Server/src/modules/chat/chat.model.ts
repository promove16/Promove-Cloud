import { Schema, model } from 'mongoose';
import { IChatMessage } from './chat.types';

const chatMessageSchema = new Schema<IChatMessage>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: {
      type: String,
      enum: ['pdf', 'image', 'doc', 'ppt', 'xls', 'video', 'audio', 'other'],
      default: undefined,
    },
    attachmentName: { type: String, default: undefined, trim: true },
    attachmentSizeBytes: { type: Number, default: undefined },
    attachmentMimeType: { type: String, default: undefined, trim: true },
    codeSnippet: {
      type: new Schema(
        {
          title: { type: String, required: true, trim: true, maxlength: 120 },
          language: { type: String, required: true, trim: true, maxlength: 60 },
          code: { type: String, required: true, maxlength: 8000 },
          lineCount: { type: Number, required: true, min: 1, max: 500 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    sentAt: { type: Date, default: () => new Date() },
    deliveredAt: { type: Date, default: undefined },
    seenAt: { type: Date, default: undefined },
    seenBy: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: false },
);

chatMessageSchema.index({ workspaceId: 1, sentAt: -1 });

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
