import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env';

export type StoredFileProvider = 's3' | 'cloudinary';
export type LegacyCloudinaryResourceType = 'image' | 'raw';

export interface UploadedFileResult {
  url: string;
  key: string;
  provider: StoredFileProvider;
}

const hasS3Config = Boolean(
  env.AWS_REGION &&
    env.AWS_ACCESS_KEY_ID &&
    env.AWS_SECRET_ACCESS_KEY &&
    env.AWS_S3_BUCKET_NAME,
);

const s3Region = hasS3Config ? env.AWS_REGION! : undefined;
const s3AccessKeyId = hasS3Config ? env.AWS_ACCESS_KEY_ID! : undefined;
const s3SecretAccessKey = hasS3Config ? env.AWS_SECRET_ACCESS_KEY! : undefined;

const s3 = hasS3Config
  ? new S3Client({
      region: s3Region,
      credentials: {
        accessKeyId: s3AccessKeyId!,
        secretAccessKey: s3SecretAccessKey!,
      },
    })
  : null;

const hasCloudinaryConfig = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const sanitizeFolder = (folder: string) =>
  folder
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');

const sanitizeFileName = (fileName: string) => {
  const parsed = path.parse(path.basename(fileName));
  const safeName = parsed.name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const safeExtension = parsed.ext
    .toLowerCase()
    .replace(/[^\w.]+/g, '')
    .slice(0, 12);

  return `${safeName || 'file'}${safeExtension}`;
};

const buildStorageKey = (folder: string, fileName: string) => {
  const normalizedFolder = sanitizeFolder(folder);
  const normalizedFileName = sanitizeFileName(fileName);
  const uniquePrefix = `${Date.now()}-${randomUUID()}`;

  return normalizedFolder
    ? `${normalizedFolder}/${uniquePrefix}-${normalizedFileName}`
    : `${uniquePrefix}-${normalizedFileName}`;
};

const getPublicBaseUrl = () =>
  (
    env.AWS_S3_PUBLIC_BASE_URL ||
    `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`
  ).replace(
    /\/+$/,
    '',
  );

const encodeObjectKey = (key: string) =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildInlineContentDisposition = (fileName: string) => {
  const fallbackName = sanitizeFileName(fileName).replace(/"/g, '');
  const encodedName = encodeURIComponent(fileName);

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

export const uploadFile = async (input: {
  buffer: Buffer;
  folder: string;
  fileName: string;
  contentType: string;
}) => {
  if (!hasS3Config) {
    if (!hasCloudinaryConfig) {
      throw new Error(
        'No upload provider is configured. Set Cloudinary credentials now, or add AWS S3 settings later.',
      );
    }

    return new Promise<UploadedFileResult>((resolve, reject) => {
      const resourceType = input.contentType.startsWith('image/') ? 'image' : 'raw';
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizeFolder(input.folder),
          resource_type: resourceType,
          timeout: 60000,
          ...(input.contentType === 'application/pdf' ? { format: 'pdf' } : {}),
        },
        (error, result) => {
          if (error || !result?.secure_url || !result.public_id) {
            reject(error ?? new Error('Upload failed'));
            return;
          }

          resolve({
            url: result.secure_url,
            key: result.public_id,
            provider: 'cloudinary',
          });
        },
      );

      Readable.from(input.buffer).pipe(uploadStream);
    });
  }

  const key = buildStorageKey(input.folder, input.fileName);

  await s3!.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      ContentDisposition: buildInlineContentDisposition(input.fileName),
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        originalname: input.fileName.slice(0, 200),
      },
    }),
  );

  return {
    url: `${getPublicBaseUrl()}/${encodeObjectKey(key)}`,
    key,
    provider: 's3' as const,
  } satisfies UploadedFileResult;
};

export const deleteS3File = async (key: string) => {
  if (!key || !hasS3Config || !s3) {
    return;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
    }),
  );
};

export const deleteLegacyCloudinaryFile = async (
  publicId: string,
  resourceType: LegacyCloudinaryResourceType,
) => {
  if (!publicId || !hasCloudinaryConfig) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export const deleteStoredAsset = async (input: {
  storageProvider?: StoredFileProvider;
  storageKey?: string;
  cloudinaryPublicId?: string;
  legacyCloudinaryResourceType?: LegacyCloudinaryResourceType;
}) => {
  if (input.storageProvider === 's3' && input.storageKey) {
    await deleteS3File(input.storageKey);
    return;
  }

  if (input.cloudinaryPublicId && input.legacyCloudinaryResourceType) {
    await deleteLegacyCloudinaryFile(
      input.cloudinaryPublicId,
      input.legacyCloudinaryResourceType,
    );
  }
};
