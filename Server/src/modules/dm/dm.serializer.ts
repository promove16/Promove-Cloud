import { Types } from 'mongoose';
import { env } from '../../config/env';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import { generatePresignedUrl } from '../../services/fileStorageService';
type DirectMessageRecord = Record<string, any>;

const stringifyObjectId = (value: unknown) => {
  if (value instanceof Types.ObjectId) return value.toString();
  return typeof value === 'string' ? value : String(value);
};

const serializeDate = (value?: Date | string) => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
};

const getConfiguredPublicBaseUrl = () =>
  env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/+$/, '') ||
  (env.AWS_S3_BUCKET_NAME && env.AWS_REGION
    ? `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`
    : undefined);

const extractS3KeyFromUrl = (fileUrl?: string) => {
  if (!fileUrl || !env.AWS_S3_BUCKET_NAME) {
    return undefined;
  }

  try {
    const parsed = new URL(fileUrl);
    const publicBaseUrl = getConfiguredPublicBaseUrl();
    if (publicBaseUrl && fileUrl.startsWith(`${publicBaseUrl}/`)) {
      return decodeURIComponent(fileUrl.slice(publicBaseUrl.length + 1));
    }

    const pathKey = parsed.pathname.replace(/^\/+/, '');
    if (parsed.hostname === `${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`) {
      return decodeURIComponent(pathKey);
    }

    if (parsed.hostname === `s3.${env.AWS_REGION}.amazonaws.com`) {
      const bucketPrefix = `${env.AWS_S3_BUCKET_NAME}/`;
      return pathKey.startsWith(bucketPrefix)
        ? decodeURIComponent(pathKey.slice(bucketPrefix.length))
        : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getAttachmentViewUrl = async (message: DirectMessageRecord) => {
  const fallbackUrl = typeof message.attachmentUrl === 'string' ? message.attachmentUrl : undefined;
  const provider =
    typeof message.attachmentStorageProvider === 'string'
      ? message.attachmentStorageProvider
      : undefined;
  const storageKey =
    typeof message.attachmentStorageKey === 'string'
      ? message.attachmentStorageKey
      : undefined;
  const inferredS3Key = provider || storageKey ? undefined : extractS3KeyFromUrl(fallbackUrl);

  try {
    if ((provider === 's3' && storageKey) || inferredS3Key) {
      return await generatePresignedUrl(storageKey || inferredS3Key!);
    }

    if (provider === 'cloudinary' && storageKey) {
      const resourceType = message.attachmentType === 'image' ? 'image' : 'raw';
      return generateSignedCloudinaryUrl(storageKey, resourceType);
    }
  } catch {
    return fallbackUrl;
  }

  return fallbackUrl;
};

export const serializeDirectMessage = async (message: DirectMessageRecord) => {
  const attachmentUrl = await getAttachmentViewUrl(message);

  return {
    _id: stringifyObjectId(message._id),
    senderId: stringifyObjectId(message.senderId),
    recipientId: stringifyObjectId(message.recipientId),
    message: typeof message.message === 'string' ? message.message : '',
    messageType: message.messageType ?? 'text',
    queryType: message.queryType ?? 'general',
    ...(message.startupId ? { startupId: stringifyObjectId(message.startupId) } : {}),
    ...(message.scheduledAt ? { scheduledAt: serializeDate(message.scheduledAt) } : {}),
    ...(message.meetLink ? { meetLink: message.meetLink } : {}),
    ...(attachmentUrl
      ? {
          attachmentUrl,
          attachmentType: message.attachmentType,
          attachmentName: message.attachmentName,
        }
      : {}),
    readAt: serializeDate(message.readAt) ?? null,
    sentAt: serializeDate(message.sentAt) ?? new Date().toISOString(),
  };
};

export const serializeDirectMessages = async (messages: DirectMessageRecord[]) =>
  Promise.all(messages.map((message) => serializeDirectMessage(message)));
