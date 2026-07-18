import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env';

const MALICIOUS_PATTERNS = [
  /<\?php/i,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /eval\s*\(/i,
  /base64_decode/i,
  /\.exe\b/i,
  /\.bat\b/i,
  /\.cmd\b/i,
  /\.msi\b/i,
  /\.vbs\b/i,
  /\.ps1\b/i,
  /\bcmd\.exe\b/i,
  /\bwscript\.exe\b/i,
  /RAR!\x1a/i,
];

export type StoredFileProvider = 's3' | 'cloudinary';
export type LegacyCloudinaryResourceType = 'image' | 'raw';

export interface UploadedFileResult {
  url: string;
  key: string;
  provider: StoredFileProvider;
}

export type ContentDispositionType = 'inline' | 'attachment';

const hasS3Config = Boolean(
  env.AWS_REGION &&
    env.AWS_S3_BUCKET_NAME,
);

const s3Region = hasS3Config ? env.AWS_REGION! : undefined;
const s3 = hasS3Config
  ? new S3Client({
      region: s3Region,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}),
            },
          }
        : {}),
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

const DANGEROUS_EXTENSIONS = [
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phar',
  '.exe', '.msi', '.bat', '.cmd', '.vbs', '.ps1', '.sh',
  '.jar', '.war', '.jsp', '.asp', '.cgi', '.pl', '.cgi',
  '.htaccess', '.htpasswd', '.bash', '.zsh',
  '.rar', '.7z', '.ace', '.arc',
];

const OFFICE_OPEN_XML_EXTENSIONS = new Set(['.docx', '.pptx', '.xlsx']);

const isZipHeader = (header: string) =>
  header.startsWith('504b0304') || header.startsWith('504b0506') || header.startsWith('504b0708');

const isOfficeOpenXmlFile = (ext: string) => OFFICE_OPEN_XML_EXTENSIONS.has(ext);

export const validateFileContent = (buffer: Buffer, originalName: string): boolean => {
  const ext = path.extname(originalName).toLowerCase();
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  const headerCheck = buffer.slice(0, 8);
  const header = headerCheck.toString('hex');
  
  if (
    header.startsWith('4d5a') ||
    header.startsWith('527878') ||
    (isZipHeader(header) && !isOfficeOpenXmlFile(ext))
  ) {
    return false;
  }
  
  try {
    const firstKB = buffer.slice(0, 2048).toString('utf8');
    if (MALICIOUS_PATTERNS.some(pattern => pattern.test(firstKB))) {
      return false;
    }
  } catch {
    return false;
  }
  
  return true;
};

export const generatePresignedUrl = async (
  storageKey: string,
  expiresInSeconds = 3600,
  responseHeaders?: {
    contentDisposition?: string;
    contentType?: string;
  },
): Promise<string> => {
  if (!hasS3Config || !s3) {
    throw new Error('S3 not configured');
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: storageKey,
    ...(responseHeaders?.contentDisposition
      ? { ResponseContentDisposition: responseHeaders.contentDisposition }
      : {}),
    ...(responseHeaders?.contentType ? { ResponseContentType: responseHeaders.contentType } : {}),
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

export const extractS3KeyFromUrl = (fileUrl?: string): string | undefined => {
  if (!fileUrl || !hasS3Config || !env.AWS_S3_BUCKET_NAME || !env.AWS_REGION) {
    return undefined;
  }

  try {
    const parsed = new URL(fileUrl);
    const publicBaseUrl = new URL(getPublicBaseUrl());

    if (parsed.origin === publicBaseUrl.origin) {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    }

    if (parsed.hostname === `${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`) {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    }

    if (parsed.hostname === `s3.${env.AWS_REGION}.amazonaws.com`) {
      const bucketPrefix = `/${env.AWS_S3_BUCKET_NAME}/`;
      if (parsed.pathname.startsWith(bucketPrefix)) {
        return decodeURIComponent(parsed.pathname.slice(bucketPrefix.length));
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
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

export const buildContentDisposition = (
  fileName: string,
  disposition: ContentDispositionType = 'inline',
) => {
  const fallbackName = sanitizeFileName(fileName).replace(/"/g, '');
  const encodedName = encodeURIComponent(fileName);

  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

const PREVIEWABLE_CONTENT_TYPES = [
  'application/pdf',
  'image/',
  'video/',
  'audio/',
] as const;

const getDispositionForContentType = (contentType: string): ContentDispositionType =>
  PREVIEWABLE_CONTENT_TYPES.some((prefix) =>
    prefix.endsWith('/') ? contentType.startsWith(prefix) : contentType === prefix,
  )
    ? 'inline'
    : 'attachment';

export const uploadFile = async (input: {
  buffer: Buffer;
  folder: string;
  fileName: string;
  contentType: string;
}) => {
  if (env.NODE_ENV === 'test') {
    const key = buildStorageKey(input.folder, input.fileName);
    return {
      url: `${getPublicBaseUrl()}/${encodeObjectKey(key)}`,
      key,
      provider: 's3' as const,
    } satisfies UploadedFileResult;
  }

  if (!hasS3Config) {
    if (!hasCloudinaryConfig) {
      throw new Error(
        'No upload provider is configured. Set AWS S3 settings, or configure Cloudinary as a legacy fallback.',
      );
    }

    return new Promise<UploadedFileResult>((resolve, reject) => {
      const resourceType = input.contentType.startsWith('image/') ? 'image' : 'auto';
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizeFolder(input.folder),
          resource_type: resourceType,
          timeout: 60000,
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
      ContentDisposition: buildContentDisposition(
        input.fileName,
        getDispositionForContentType(input.contentType),
      ),
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

export const uploadFileToS3 = async (input: {
  buffer: Buffer;
  folder: string;
  fileName: string;
  contentType: string;
}) => {
  if (!hasS3Config || !s3) {
    throw new Error('S3 not configured');
  }

  const key = buildStorageKey(input.folder, input.fileName);

  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      ContentDisposition: buildContentDisposition(
        input.fileName,
        getDispositionForContentType(input.contentType),
      ),
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

  const cloudinaryPublicId = input.cloudinaryPublicId || (input.storageProvider === 'cloudinary' ? input.storageKey : undefined);

  if (cloudinaryPublicId && input.legacyCloudinaryResourceType) {
    await deleteLegacyCloudinaryFile(
      cloudinaryPublicId,
      input.legacyCloudinaryResourceType,
    );
  }
};
