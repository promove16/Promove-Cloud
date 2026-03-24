import { Types } from 'mongoose';

export interface IChatMessage {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  senderId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'pdf' | 'image';
  sentAt: Date;
}
