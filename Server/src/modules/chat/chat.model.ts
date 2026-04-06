import { Schema, model } from 'mongoose';
import { IChatMessage } from './chat.types';
import { DEFAULT_TEMPORARY_MEMORY_MODE } from '../temporaryMemory/temporaryMemory.constants';

const chatMessageSchema = new Schema<IChatMessage>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, default: '', trim: true },
    attachmentUrl: { type: String, default: undefined },
    attachmentType: { type: String, enum: ['pdf', 'image'], default: undefined },
    memoryMode: {
      type: String,
      enum: ['standard', 'temporary'],
      default: DEFAULT_TEMPORARY_MEMORY_MODE,
    },
    expiresAt: { type: Date, default: undefined },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

chatMessageSchema.index({ workspaceId: 1, sentAt: -1 });
chatMessageSchema.index({ memoryMode: 1, expiresAt: 1 });

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
