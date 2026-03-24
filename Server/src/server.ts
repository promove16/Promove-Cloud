import http from 'http';
import app from './app';
import { startNotificationWorker } from './jobs/notificationWorker';
import { startScoreWorker } from './jobs/scoreRecalcWorker';
import { seedProblemsIfEmpty } from './modules/problemBank/problem.service';
import { initSocket } from './config/socket';
import { connectDB } from './config/db';
import { env } from './config/env';

const startServer = async () => {
  await connectDB();
  await seedProblemsIfEmpty();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  if (env.NODE_ENV !== 'test') {
    startScoreWorker();
    startNotificationWorker();
  }

  httpServer.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
};

process.on('uncaughtException', (error) => {
  console.error('uncaughtException', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('unhandledRejection', error);
  process.exit(1);
});

void startServer();
