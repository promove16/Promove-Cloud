import { generateKeyPairSync } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

jest.setTimeout(180_000);

const { privateKey: accessPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const { privateKey: refreshPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.AWS_REDIS_HOST = 'example.cache.amazonaws.com';
process.env.AWS_REDIS_PORT = '6379';
process.env.AWS_REDIS_TLS = 'true';
process.env.JWT_ACCESS_SECRET = accessPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_REFRESH_SECRET = refreshPrivateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '30d';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.GITHUB_CLIENT_ID = 'github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
process.env.GITHUB_OAUTH_CALLBACK_URL = 'http://localhost:5000/api/users/github/callback';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET_NAME = 'promove-test-bucket';
process.env.AWS_S3_PUBLIC_BASE_URL = 'https://promove-test-bucket.s3.ap-south-1.amazonaws.com';
process.env.FROM_EMAIL = 'noreply@promovecyc.com';

let mongoServer: MongoMemoryReplSet;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const dropDatabaseWithRetry = async (attempts = 5) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await mongoose.connection.db?.dropDatabase();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (!message.includes('currently being dropped') || attempt === attempts - 1) {
        throw error;
      }

      await wait(50 * (attempt + 1));
    }
  }
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
  const { clearRedisForTests } = await import('../src/config/redis');
  clearRedisForTests();
  await dropDatabaseWithRetry();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});
