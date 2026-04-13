import { generateKeyPairSync } from 'crypto';

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
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
process.env.UPSTASH_REDIS_HOST = 'example.upstash.io';
process.env.UPSTASH_REDIS_PASSWORD = 'password';
process.env.JWT_ACCESS_SECRET = accessPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_REFRESH_SECRET = refreshPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '30d';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET_NAME = 'promove-test-bucket';
process.env.AWS_S3_PUBLIC_BASE_URL = 'https://promove-test-bucket.s3.ap-south-1.amazonaws.com';
process.env.FROM_EMAIL = 'noreply@promovecyc.com';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/promove-test-bootstrap';
