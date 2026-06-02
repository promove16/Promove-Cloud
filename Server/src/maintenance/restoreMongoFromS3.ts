import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EJSON } from 'bson';
import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import readline from 'readline';
import type { Readable } from 'stream';
import type { Document } from 'mongodb';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logError, logger } from '../config/logger';

/**
 * Restores a backup produced by mongoNativeBackupService.
 *
 *   npm run restore:mongo -- --key=backups/mongo-native/<file>.ndjson.gz [--drop]
 *
 * Safety: refuses to run unless CONFIRM_RESTORE=yes is set, because it writes
 * into whatever database MONGODB_URI points at. With --drop it first drops each
 * collection found in the archive before re-inserting.
 */
const INSERT_BATCH_SIZE = 500;

type CliArgs = { key?: string; bucket?: string; drop: boolean };

const parseArgs = (): CliArgs => {
  const args: CliArgs = { drop: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--drop') {
      args.drop = true;
    } else if (arg.startsWith('--key=')) {
      args.key = arg.slice('--key='.length);
    } else if (arg.startsWith('--bucket=')) {
      args.bucket = arg.slice('--bucket='.length);
    }
  }
  return args;
};

const getS3Client = () => {
  if (!env.AWS_REGION) {
    throw new Error('Mongo restore requires AWS_REGION.');
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

const downloadArchive = async (bucket: string, key: string, destination: string) => {
  const s3 = getS3Client();
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!response.Body) {
    throw new Error(`S3 object ${bucket}/${key} returned an empty body.`);
  }

  await pipeline(response.Body as Readable, createWriteStream(destination));
};

const run = async () => {
  const args = parseArgs();
  const bucket = args.bucket ?? env.AWS_S3_BUCKET_NAME;

  if (!args.key) {
    throw new Error('Missing --key=<s3-object-key> argument.');
  }
  if (!bucket) {
    throw new Error('No bucket provided. Set AWS_S3_BUCKET_NAME or pass --bucket=.');
  }
  if (process.env.CONFIRM_RESTORE !== 'yes') {
    throw new Error(
      'Refusing to restore without confirmation. Re-run with CONFIRM_RESTORE=yes to overwrite ' +
        `data in the database targeted by MONGODB_URI${args.drop ? ' (collections will be DROPPED)' : ''}.`,
    );
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'promove-mongo-restore-'));
  const archivePath = path.join(tempDir, `${randomUUID()}.ndjson.gz`);
  const ndjsonPath = path.join(tempDir, `${randomUUID()}.ndjson`);

  try {
    logger.info('Downloading backup archive from S3', { bucket, key: args.key });
    await downloadArchive(bucket, args.key, archivePath);

    await pipeline(createReadStream(archivePath), createGunzip(), createWriteStream(ndjsonPath));

    await connectDB();
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error('MongoDB connection is not ready.');
    }

    const reader = readline.createInterface({
      input: createReadStream(ndjsonPath),
      crlfDelay: Infinity,
    });

    let currentCollection: string | null = null;
    let pendingIndexes: { key: Record<string, number>; name?: string; unique?: boolean }[] = [];
    let buffer: Document[] = [];
    const counts = new Map<string, number>();
    const droppedCollections = new Set<string>();

    const flushBuffer = async () => {
      if (!currentCollection || buffer.length === 0) {
        return;
      }
      await database.collection(currentCollection).insertMany(buffer, { ordered: false });
      counts.set(currentCollection, (counts.get(currentCollection) ?? 0) + buffer.length);
      buffer = [];
    };

    const createPendingIndexes = async () => {
      if (!currentCollection || pendingIndexes.length === 0) {
        return;
      }
      for (const index of pendingIndexes) {
        if (index.name === '_id_') {
          continue;
        }
        try {
          await database
            .collection(currentCollection)
            .createIndex(index.key, { name: index.name, unique: index.unique });
        } catch (error) {
          logError(`Failed to recreate index on ${currentCollection}`, error);
        }
      }
      pendingIndexes = [];
    };

    for await (const line of reader) {
      if (!line.trim()) {
        continue;
      }

      const record = EJSON.parse(line) as Record<string, unknown>;

      if (record.t === 'meta') {
        logger.info('Restoring backup', {
          generatedAt: record.generatedAt,
          sourceDatabase: record.database,
          targetDatabase: database.databaseName,
        });
        continue;
      }

      if (record.t === 'collection') {
        await flushBuffer();
        await createPendingIndexes();

        currentCollection = String(record.name);
        pendingIndexes = (record.indexes as typeof pendingIndexes) ?? [];

        if (args.drop && !droppedCollections.has(currentCollection)) {
          await database
            .collection(currentCollection)
            .drop()
            .catch(() => undefined);
          droppedCollections.add(currentCollection);
          logger.info('Dropped collection before restore', { collection: currentCollection });
        }
        continue;
      }

      if (record.t === 'doc' && currentCollection) {
        buffer.push(record.doc as Document);
        if (buffer.length >= INSERT_BATCH_SIZE) {
          await flushBuffer();
        }
      }
    }

    await flushBuffer();
    await createPendingIndexes();

    const summary = Array.from(counts.entries()).map(([collection, inserted]) => ({
      collection,
      inserted,
    }));

    logger.info('Mongo restore completed', { collections: summary.length });
    console.log(JSON.stringify({ restored: summary }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

void run()
  .catch((error) => {
    logError('Mongo restore script failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
