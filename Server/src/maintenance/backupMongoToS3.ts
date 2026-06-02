import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logError, logger } from '../config/logger';
import { runMongoDisasterBackup } from '../services/mongoDisasterBackupService';
import { runMongoExcelBackup } from '../services/mongoExcelBackupService';
import { runMongoNativeBackup } from '../services/mongoNativeBackupService';

const run = async () => {
  await connectDB();
  const nativeResult = env.MONGO_NATIVE_BACKUP_ENABLED
    ? await runMongoNativeBackup()
    : null;
  const disasterResult = env.MONGO_DISASTER_BACKUP_ENABLED
    ? await runMongoDisasterBackup()
    : null;
  const excelResult = await runMongoExcelBackup();

  logger.info('Mongo Excel backup completed', {
    s3Uri: excelResult.s3Uri,
    fileSizeBytes: excelResult.fileSizeBytes,
    collections: excelResult.collections.length,
    nativeBackupS3Uri: nativeResult?.s3Uri,
    disasterBackupS3Uri: disasterResult?.s3Uri,
  });

  console.log(
    JSON.stringify(
      {
        nativeBackup: nativeResult
          ? {
              s3Uri: nativeResult.s3Uri,
              fileSizeBytes: nativeResult.fileSizeBytes,
              generatedAt: nativeResult.generatedAt,
              collections: nativeResult.collections.length,
            }
          : null,
        disasterBackup: disasterResult
          ? {
              s3Uri: disasterResult.s3Uri,
              fileSizeBytes: disasterResult.fileSizeBytes,
              generatedAt: disasterResult.generatedAt,
            }
          : null,
        excelBackup: {
          s3Uri: excelResult.s3Uri,
          fileSizeBytes: excelResult.fileSizeBytes,
          generatedAt: excelResult.generatedAt,
          collections: excelResult.collections,
        },
      },
      null,
      2,
    ),
  );
};

void run()
  .catch((error) => {
    logError('Mongo Excel backup script failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
