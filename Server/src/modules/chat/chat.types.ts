import { Types } from 'mongoose';
import { TemporaryMemoryMode } from '../temporaryMemory/temporaryMemory.constants';

export interface IChatMessage {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  senderId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'pdf' | 'image';
  memoryMode: TemporaryMemoryMode;
  expiresAt?: Date;
  sentAt: Date;
}
