import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import ExcelJS from 'exceljs';
import { createReadStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import type { Collection, Document, WithId } from 'mongodb';
import { env } from '../config/env';
import { logger } from '../config/logger';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_CELL_LIMIT = 32767;
const DEFAULT_BATCH_SIZE = 500;

export type MongoExcelBackupCollectionResult = {
  collectionName: string;
  sheetName: string;
  estimatedDocuments: number;
  exportedRows: number;
  truncated: boolean;
};

export type MongoExcelBackupResult = {
  bucket: string;
  key: string;
  s3Uri: string;
  fileName: string;
  fileSizeBytes: number;
  generatedAt: string;
  collections: MongoExcelBackupCollectionResult[];
};

const getS3Client = () => {
  if (!env.AWS_REGION || !env.AWS_S3_BUCKET_NAME) {
    throw new Error('Mongo Excel backup requires AWS_REGION and AWS_S3_BUCKET_NAME.');
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

const sanitizeSheetNameBase = (name: string) => {
  const sanitized = name.replace(/[\[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '').trim();
  return (sanitized || 'collection').slice(0, 31);
};

const createUniqueSheetName = (collectionName: string, usedNames: Set<string>) => {
  const base = sanitizeSheetNameBase(collectionName);
  let candidate = base;
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const truncateCellText = (value: string) =>
  value.length > EXCEL_CELL_LIMIT
    ? `${value.slice(0, EXCEL_CELL_LIMIT - 22)}...[truncated for Excel]`
    : value;

const protectExcelFormula = (value: string) =>
  /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;

const stringifyForCell = (value: unknown): string => {
  try {
    return JSON.stringify(value, (_key, nestedValue) => {
      if (nestedValue instanceof Date) {
        return nestedValue.toISOString();
      }

      if (Buffer.isBuffer(nestedValue)) {
        return `[buffer ${nestedValue.length} bytes]`;
      }

      if (
        nestedValue &&
        typeof nestedValue === 'object' &&
        'toHexString' in nestedValue &&
        typeof (nestedValue as { toHexString?: unknown }).toHexString === 'function'
      ) {
        return (nestedValue as { toHexString: () => string }).toHexString();
      }

      return nestedValue;
    });
  } catch {
    return String(value);
  }
};

const serializeCellValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer ${value.length} bytes]`;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toHexString' in value &&
    typeof (value as { toHexString?: unknown }).toHexString === 'function'
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }

  const rendered = typeof value === 'string' ? value : stringifyForCell(value);
  return protectExcelFormula(truncateCellText(rendered));
};

const parseRequestedCollections = () => {
  if (!env.MONGO_EXCEL_BACKUP_COLLECTIONS) {
    return null;
  }

  return new Set(
    env.MONGO_EXCEL_BACKUP_COLLECTIONS.split(',')
      .map((collection) => collection.trim())
      .filter(Boolean),
  );
};

const discoverColumns = async (collection: Collection<Document>) => {
  const sampleDocs = await collection
    .find({}, { batchSize: Math.min(env.MONGO_EXCEL_BACKUP_SAMPLE_SIZE, DEFAULT_BATCH_SIZE) })
    .limit(env.MONGO_EXCEL_BACKUP_SAMPLE_SIZE)
    .toArray();
  const columns = new Set<string>(['_id']);

  for (const doc of sampleDocs) {
    Object.keys(doc).forEach((key) => columns.add(key));
  }

  return Array.from(columns);
};

const extractExtraFields = (doc: WithId<Document>, knownColumns: Set<string>) => {
  const extra: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (!knownColumns.has(key)) {
      extra[key] = value;
    }
  }

  return Object.keys(extra).length > 0 ? extra : null;
};

const writeCollectionSheet = async (
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  collection: Collection<Document>,
  sheetName: string,
): Promise<MongoExcelBackupCollectionResult> => {
  const estimatedDocuments = await collection.estimatedDocumentCount();
  const columns = await discoverColumns(collection);
  const knownColumns = new Set(columns);
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow([...columns, '__extra']).commit();

  let exportedRows = 0;
  let truncated = false;
  const cursor = collection.find({}, { batchSize: DEFAULT_BATCH_SIZE });

  try {
    for await (const doc of cursor) {
      if (exportedRows >= env.MONGO_EXCEL_BACKUP_MAX_DOCS_PER_COLLECTION) {
        truncated = true;
        break;
      }

      const extraFields = extractExtraFields(doc, knownColumns);
      worksheet
        .addRow([
          ...columns.map((column) => serializeCellValue(doc[column])),
          extraFields ? serializeCellValue(extraFields) : null,
        ])
        .commit();
      exportedRows += 1;
    }
  } finally {
    await cursor.close();
  }

  worksheet.commit();

  return {
    collectionName: collection.collectionName,
    sheetName,
    estimatedDocuments,
    exportedRows,
    truncated,
  };
};

const writeManifestSheet = (
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  input: {
    generatedAt: string;
    databaseName: string;
    collections: MongoExcelBackupCollectionResult[];
  },
) => {
  const worksheet = workbook.addWorksheet('backup_manifest');

  worksheet.addRow(['Field', 'Value']).commit();
  worksheet.addRow(['generatedAt', input.generatedAt]).commit();
  worksheet.addRow(['database', input.databaseName]).commit();
  worksheet.addRow(['maxDocsPerCollection', env.MONGO_EXCEL_BACKUP_MAX_DOCS_PER_COLLECTION]).commit();
  worksheet.addRow([]).commit();
  worksheet
    .addRow(['Collection', 'Sheet', 'Estimated documents', 'Exported rows', 'Truncated'])
    .commit();

  input.collections.forEach((collection) => {
    worksheet
      .addRow([
        collection.collectionName,
        collection.sheetName,
        collection.estimatedDocuments,
        collection.exportedRows,
        collection.truncated,
      ])
      .commit();
  });

  worksheet.commit();
};

const buildBackupFileName = (generatedAt: string) =>
  `mongodb-backup-${generatedAt.replace(/[:.]/g, '-')}.xlsx`;

const buildBackupKey = (fileName: string) => {
  const prefix = sanitizeS3Prefix(env.MONGO_EXCEL_BACKUP_S3_PREFIX);
  return prefix ? `${prefix}/${fileName}` : fileName;
};

export const runMongoExcelBackup = async (): Promise<MongoExcelBackupResult> => {
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error('MongoDB connection is not ready.');
  }

  const s3 = getS3Client();
  const generatedAt = new Date().toISOString();
  const fileName = buildBackupFileName(generatedAt);
  const key = buildBackupKey(fileName);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'promove-mongo-backup-'));
  const tempFilePath = path.join(tempDir, `${randomUUID()}.xlsx`);

  try {
    const requestedCollections = parseRequestedCollections();
    const collectionInfos = await database.listCollections({}, { nameOnly: true }).toArray();
    const collections = collectionInfos
      .map((collectionInfo) => collectionInfo.name)
      .filter((collectionName) => !requestedCollections || requestedCollections.has(collectionName))
      .sort();
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: tempFilePath,
      useSharedStrings: false,
      useStyles: false,
    });
    const usedSheetNames = new Set<string>();
    const collectionResults: MongoExcelBackupCollectionResult[] = [];

    for (const collectionName of collections) {
      const collection = database.collection(collectionName);
      const sheetName = createUniqueSheetName(collectionName, usedSheetNames);
      logger.info('Writing Mongo Excel backup sheet', { collectionName, sheetName });
      collectionResults.push(await writeCollectionSheet(workbook, collection, sheetName));
    }

    writeManifestSheet(workbook, {
      generatedAt,
      databaseName: database.databaseName,
      collections: collectionResults,
    });

    await workbook.commit();

    const fileStats = await stat(tempFilePath);

    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: createReadStream(tempFilePath),
        ContentType: XLSX_CONTENT_TYPE,
        ContentDisposition: `attachment; filename="${fileName}"`,
        ServerSideEncryption: 'AES256',
        Metadata: {
          generatedat: generatedAt,
          database: database.databaseName.slice(0, 200),
          collectioncount: String(collectionResults.length),
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
      collections: collectionResults,
    };

    logger.info('Mongo Excel backup uploaded to S3', {
      s3Uri: result.s3Uri,
      fileSizeBytes: result.fileSizeBytes,
      collections: result.collections.length,
    });

    await deleteExpiredMongoExcelBackups({
      s3,
      currentBackupKey: key,
    });

    return result;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const deleteExpiredMongoExcelBackups = async (input?: {
  s3?: S3Client;
  currentBackupKey?: string;
}) => {
  if (!env.AWS_S3_BUCKET_NAME) {
    return 0;
  }

  const retentionDays = env.MONGO_EXCEL_BACKUP_RETENTION_DAYS;
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const s3 = input?.s3 ?? getS3Client();
  const prefix = sanitizeS3Prefix(env.MONGO_EXCEL_BACKUP_S3_PREFIX);
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

        const isBackupWorkbook = object.Key.endsWith('.xlsx');
        const lastModifiedTime = object.LastModified?.getTime();

        return Boolean(isBackupWorkbook && lastModifiedTime && lastModifiedTime < cutoffTime);
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
    logger.info('Deleted expired Mongo Excel backups from S3', {
      deletedCount,
      retentionDays,
      prefix: env.MONGO_EXCEL_BACKUP_S3_PREFIX,
    });
  }

  return deletedCount;
};
