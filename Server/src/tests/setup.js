const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5001';
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test_access_token_secret_64_chars_long_for_testing_only_123456';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/promove_dev_test';

let memoryServer;
let testMongoUri;

beforeAll(async () => {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    testMongoUri = memoryServer.getUri();
  } catch (error) {
    const baseUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    testMongoUri = baseUri.endsWith('_test') ? baseUri : `${baseUri}_test`;
  }

  await mongoose.connect(testMongoUri);
});

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  if (memoryServer) {
    await memoryServer.stop();
  }
});
