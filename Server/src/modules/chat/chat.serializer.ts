import { Types } from 'mongoose';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import { generatePresignedUrl } from '../../services/fileStorageService';
import type { IChatMessage } from './chat.types';

type ChatMessageRecord = Partial<IChatMessage> & Record<string, unknown>;

const serializeDate = (value?: Date | string) => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
};

const stringifyObjectId = (value: unknown) => {
  if (value instanceof Types.ObjectId) return value.toString();
  return typeof value === 'string' ? value : String(value);
};

const getAttachmentViewUrl = async (message: ChatMessageRecord) => {
  const fallbackUrl = typeof message.attachmentUrl === 'string' ? message.attachmentUrl : undefined;
  const storageProvider =
    typeof message.attachmentStorageProvider === 'string'
      ? message.attachmentStorageProvider
      : undefined;
  const storageKey =
    typeof message.attachmentStorageKey === 'string'
      ? message.attachmentStorageKey
      : undefined;

  if (!storageProvider || !storageKey) {
    return fallbackUrl;
  }

  try {
    if (storageProvider === 's3') {
      return await generatePresignedUrl(storageKey);
    }

    if (storageProvider === 'cloudinary') {
      const resourceType = message.attachmentType === 'image' ? 'image' : 'raw';
      return generateSignedCloudinaryUrl(storageKey, resourceType);
    }
  } catch {
    return fallbackUrl;
  }

  return fallbackUrl;
};

export const serializeChatMessage = async (message: ChatMessageRecord) => {
  const attachmentUrl = await getAttachmentViewUrl(message);
  const attachmentType = message.attachmentType as IChatMessage['attachmentType'];
  const attachmentName =
    typeof message.attachmentName === 'string' ? message.attachmentName : undefined;
  const attachmentSizeBytes =
    typeof message.attachmentSizeBytes === 'number' ? message.attachmentSizeBytes : undefined;
  const attachmentMimeType =
    typeof message.attachmentMimeType === 'string' ? message.attachmentMimeType : undefined;
  const attachmentUploadId = message.attachmentUploadId
    ? stringifyObjectId(message.attachmentUploadId)
    : undefined;

  return {
    _id: stringifyObjectId(message._id),
    workspaceId: stringifyObjectId(message.workspaceId),
    senderId: stringifyObjectId(message.senderId),
    message: typeof message.message === 'string' ? message.message : '',
    ...(attachmentUrl && attachmentType
      ? {
          attachmentUrl,
          attachmentType,
          attachmentName,
          attachmentSizeBytes,
          attachmentMimeType,
          attachmentUploadId,
          attachment: {
            fileUrl: attachmentUrl,
            fileType: attachmentType,
            fileName: attachmentName ?? 'Attachment',
            fileSizeBytes: attachmentSizeBytes ?? 0,
            ...(attachmentMimeType ? { mimeType: attachmentMimeType } : {}),
          },
        }
      : {}),
    ...(message.codeSnippet && typeof message.codeSnippet === 'object'
      ? {
          codeSnippet: {
            title: String((message.codeSnippet as Record<string, unknown>).title ?? ''),
            language: String((message.codeSnippet as Record<string, unknown>).language ?? ''),
            code: String((message.codeSnippet as Record<string, unknown>).code ?? ''),
            lineCount: Number((message.codeSnippet as Record<string, unknown>).lineCount ?? 0),
          },
        }
      : {}),
    sentAt: serializeDate(message.sentAt) ?? new Date().toISOString(),
    ...(message.deliveredAt ? { deliveredAt: serializeDate(message.deliveredAt) } : {}),
    ...(message.seenAt ? { seenAt: serializeDate(message.seenAt) } : {}),
    seenBy: Array.isArray(message.seenBy)
      ? message.seenBy.map((entry) => stringifyObjectId(entry))
      : [],
  };
};
