import { Types } from 'mongoose';

export type ChatAttachmentType =
  | 'pdf'
  | 'image'
  | 'doc'
  | 'ppt'
  | 'xls'
  | 'video'
  | 'audio'
  | 'other';

export interface IChatMessage {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  senderId: Types.ObjectId;
  message: string;
  attachmentUrl?: string;
  attachmentType?: ChatAttachmentType;
  attachmentName?: string;
  attachmentSizeBytes?: number;
  attachmentMimeType?: string;
  attachmentUploadId?: Types.ObjectId;
  attachmentStorageProvider?: 's3' | 'cloudinary';
  attachmentStorageKey?: string;
  codeSnippet?: {
    title: string;
    language: string;
    code: string;
    lineCount: number;
  };
  sentAt: Date;
  deliveredAt?: Date;
  seenAt?: Date;
  seenBy?: Types.ObjectId[];
}
