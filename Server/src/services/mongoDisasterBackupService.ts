import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { env } from '../config/env';
import { logger } from '../config/logger';

const ARCHIVE_CONTENT_TYPE = 'application/gzip';

export type MongoDisasterBackupResult = {
  bucket: string;
  key: string;
  s3Uri: string;
  fileName: string;
  fileSizeBytes: number;
  generatedAt: string;
};

const getS3Client = () => {
  if (!env.AWS_REGION || !env.AWS_S3_BUCKET_NAME) {
    throw new Error('Mongo disaster backup requires AWS_REGION and AWS_S3_BUCKET_NAME.');
  }

  return new S3Client({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}),
          },
        }
      : {}),
  });
};

const sanitizeS3Prefix = (prefix: string) =>
  prefix
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');

const buildBackupFileName = (generatedAt: string) =>
  `mongodb-disaster-backup-${generatedAt.replace(/[:.]/g, '-')}.archive.gz`;

const buildBackupKey = (fileName: string) => {
  const prefix = sanitizeS3Prefix(env.MONGO_DISASTER_BACKUP_S3_PREFIX);
  return prefix ? `${prefix}/${fileName}` : fileName;
};

const runMongodump = (archivePath: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      env.MONGODUMP_BIN,
      ['--uri', env.MONGODB_URI, `--archive=${archivePath}`, '--gzip'],
      {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `mongodump executable not found. Install MongoDB Database Tools or set MONGODUMP_BIN to the full mongodump path.`,
          ),
        );
        return;
      }

      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`mongodump failed with exit code ${code}: ${stderr.trim()}`));
    });
  });

export const runMongoDisasterBackup = async (): Promise<MongoDisasterBackupResult> => {
  const s3 = getS3Client();
  const generatedAt = new Date().toISOString();
  const fileName = buildBackupFileName(generatedAt);
  const key = buildBackupKey(fileName);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'promove-mongo-disaster-backup-'));
  const archivePath = path.join(tempDir, `${randomUUID()}.archive.gz`);

  try {
    logger.info('Starting MongoDB disaster backup archive.');
    await runMongodump(archivePath);

    const fileStats = await stat(archivePath);

    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: createReadStream(archivePath),
        ContentType: ARCHIVE_CONTENT_TYPE,
        ContentDisposition: `attachment; filename="${fileName}"`,
        ServerSideEncryption: 'AES256',
        Metadata: {
          generatedat: generatedAt,
          format: 'mongodump-archive-gzip',
          restorehint: 'mongorestore --gzip --archive=<file>',
        },
      }),
    );

    const result = {
      bucket: env.AWS_S3_BUCKET_NAME!,
      key,
      s3Uri: `s3://${env.AWS_S3_BUCKET_NAME}/${key}`,
      fileName,
      fileSizeBytes: fileStats.size,
      generatedAt,
    };

    logger.info('MongoDB disaster backup uploaded to S3', {
      s3Uri: result.s3Uri,
      fileSizeBytes: result.fileSizeBytes,
    });

    await deleteExpiredMongoDisasterBackups({
      s3,
      currentBackupKey: key,
    });

    return result;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const deleteExpiredMongoDisasterBackups = async (input?: {
  s3?: S3Client;
  currentBackupKey?: string;
}) => {
  if (!env.AWS_S3_BUCKET_NAME) {
    return 0;
  }

  const retentionDays = env.MONGO_EXCEL_BACKUP_RETENTION_DAYS;
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const s3 = input?.s3 ?? getS3Client();
  const prefix = sanitizeS3Prefix(env.MONGO_DISASTER_BACKUP_S3_PREFIX);
  let continuationToken: string | undefined;
  let deletedCount = 0;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Prefix: prefix ? `${prefix}/` : undefined,
        ContinuationToken: continuationToken,
      }),
    );

    const expiredKeys = (response.Contents ?? [])
      .filter((object) => {
        if (!object.Key || object.Key === input?.currentBackupKey) {
          return false;
        }

        const isArchive = object.Key.endsWith('.archive.gz');
        const lastModifiedTime = object.LastModified?.getTime();

        return Boolean(isArchive && lastModifiedTime && lastModifiedTime < cutoffTime);
      })
      .map((object) => ({ Key: object.Key! }));

    for (let index = 0; index < expiredKeys.length; index += 1000) {
      const objects = expiredKeys.slice(index, index + 1000);
      if (objects.length === 0) {
        continue;
      }

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.AWS_S3_BUCKET_NAME,
          Delete: {
            Objects: objects,
            Quiet: true,
          },
        }),
      );
      deletedCount += objects.length;
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  if (deletedCount > 0) {
    logger.info('Deleted expired MongoDB disaster backups from S3', {
      deletedCount,
      retentionDays,
      prefix: env.MONGO_DISASTER_BACKUP_S3_PREFIX,
    });
  }

  return deletedCount;
};
