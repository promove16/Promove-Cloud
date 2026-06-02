import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { EJSON } from 'bson';
import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { logError, logger } from '../config/logger';

const ARCHIVE_CONTENT_TYPE = 'application/gzip';
const CURSOR_BATCH_SIZE = 500;

/**
 * Pure-Node logical backup. Streams every collection to a gzipped NDJSON
 * archive using BSON Extended JSON so ObjectId/Date/Binary/Decimal128 types
 * survive a round-trip. Restorable with restoreMongoFromS3 — no mongodump /
 * mongorestore binaries required, so it runs on any host.
 *
 * Line protocol (one EJSON object per line):
 *   {"t":"meta","generatedAt":...,"database":...,"format":"ndjson-ejson-gzip"}
 *   {"t":"collection","name":"users","indexes":[...]}
 *   {"t":"doc","doc":{...}}            // repeated for each document
 */
export type MongoNativeBackupResult = {
  bucket: string;
  key: string;
  s3Uri: string;
  fileName: string;
  fileSizeBytes: number;
  generatedAt: string;
  collections: { collectionName: string; exportedDocuments: number }[];
};

const getS3Client = () => {
  if (!env.AWS_REGION || !env.AWS_S3_BUCKET_NAME) {
    throw new Error('Mongo native backup requires AWS_REGION and AWS_S3_BUCKET_NAME.');
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
  `mongodb-native-backup-${generatedAt.replace(/[:.]/g, '-')}.ndjson.gz`;

const buildBackupKey = (fileName: string) => {
  const prefix = sanitizeS3Prefix(env.MONGO_NATIVE_BACKUP_S3_PREFIX);
  return prefix ? `${prefix}/${fileName}` : fileName;
};

export const runMongoNativeBackup = async (): Promise<MongoNativeBackupResult> => {
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error('MongoDB connection is not ready.');
  }

  const s3 = getS3Client();
  const generatedAt = new Date().toISOString();
  const fileName = buildBackupFileName(generatedAt);
  const key = buildBackupKey(fileName);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'promove-mongo-native-backup-'));
  const archivePath = path.join(tempDir, `${randomUUID()}.ndjson.gz`);

  try {
    logger.info('Starting MongoDB native (code-based) backup.');

    const source = new PassThrough();
    // Drive the gzip pipeline concurrently while we push lines into `source`.
    const writePipeline = pipeline(source, createGzip(), createWriteStream(archivePath));

    const writeLine = async (value: unknown) => {
      const line = `${EJSON.stringify(value, { relaxed: false })}\n`;
      if (!source.write(line)) {
        await new Promise<void>((resolve) => source.once('drain', resolve));
      }
    };

    const collectionInfos = await database.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collectionInfos
      .map((info) => info.name)
      .filter((name) => !name.startsWith('system.'))
      .sort();

    const collectionResults: { collectionName: string; exportedDocuments: number }[] = [];

    await writeLine({
      t: 'meta',
      generatedAt,
      database: database.databaseName,
      format: 'ndjson-ejson-gzip',
      version: 1,
    });

    for (const collectionName of collectionNames) {
      const collection = database.collection(collectionName);
      let indexes: unknown[] = [];
      try {
        indexes = await collection.indexes();
      } catch (error) {
        logError(`Failed to read indexes for collection ${collectionName}`, error);
      }

      await writeLine({ t: 'collection', name: collectionName, indexes });

      let exportedDocuments = 0;
      const cursor = collection.find({}, { batchSize: CURSOR_BATCH_SIZE });
      try {
        for await (const doc of cursor) {
          await writeLine({ t: 'doc', doc });
          exportedDocuments += 1;
        }
      } finally {
        await cursor.close();
      }

      logger.info('Wrote Mongo native backup collection', { collectionName, exportedDocuments });
      collectionResults.push({ collectionName, exportedDocuments });
    }

    source.end();
    await writePipeline;

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
          format: 'ndjson-ejson-gzip',
          database: database.databaseName.slice(0, 200),
          collectioncount: String(collectionResults.length),
          restorehint: 'npm run restore:mongo -- --key=<s3-key>',
        },
      }),
    );

    const result: MongoNativeBackupResult = {
      bucket: env.AWS_S3_BUCKET_NAME!,
      key,
      s3Uri: `s3://${env.AWS_S3_BUCKET_NAME}/${key}`,
      fileName,
      fileSizeBytes: fileStats.size,
      generatedAt,
      collections: collectionResults,
    };

    logger.info('MongoDB native backup uploaded to S3', {
      s3Uri: result.s3Uri,
      fileSizeBytes: result.fileSizeBytes,
      collections: result.collections.length,
    });

    // Best-effort: a cleanup failure (e.g. missing s3:ListBucket/DeleteObject)
    // must not fail an already-successful backup.
    try {
      await deleteExpiredMongoNativeBackups({ s3, currentBackupKey: key });
    } catch (error) {
      logError('Failed to prune expired Mongo native backups (backup itself succeeded)', error);
    }

    return result;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const deleteExpiredMongoNativeBackups = async (input?: {
  s3?: S3Client;
  currentBackupKey?: string;
}) => {
  if (!env.AWS_S3_BUCKET_NAME) {
    return 0;
  }

  const retentionDays = env.MONGO_EXCEL_BACKUP_RETENTION_DAYS;
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const s3 = input?.s3 ?? getS3Client();
  const prefix = sanitizeS3Prefix(env.MONGO_NATIVE_BACKUP_S3_PREFIX);
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

        const isArchive = object.Key.endsWith('.ndjson.gz');
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
    logger.info('Deleted expired MongoDB native backups from S3', {
      deletedCount,
      retentionDays,
      prefix: env.MONGO_NATIVE_BACKUP_S3_PREFIX,
    });
  }

  return deletedCount;
};
