const config = require('./config/env');

process.on('uncaughtException', (error) => {
  console.error('[Server] uncaughtException:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('[Server] unhandledRejection:', error);
  process.exit(1);
});

const app = require('./app');
const { connectDB } = require('./config/db');

(async () => {
  await connectDB();

  app.listen(config.PORT, () => {
    console.log(`[Server] ProMove API running on port ${config.PORT}`);
  });
})();
