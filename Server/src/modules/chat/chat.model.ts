import { Schema, model } from 'mongoose';
import { IChatMessage } from './chat.types';

const chatMessageSchema = new Schema<IChatMessage>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: { type: String, enum: ['pdf', 'image'], default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

chatMessageSchema.index({ workspaceId: 1, sentAt: -1 });

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
