const mongoose = require('mongoose');
const config = require('./env');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

async function connectDB(attempt = 1) {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('[DB] MongoDB connected.');
  } catch (error) {
    console.error(`[DB] Connection attempt ${attempt} failed:`, error);

    if (attempt >= MAX_RETRIES) {
      console.error('[DB] Fatal: unable to connect to MongoDB after 5 retries.');
      process.exit(1);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return connectDB(attempt + 1);
  }
}

module.exports = { connectDB };
