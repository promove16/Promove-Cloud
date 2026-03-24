import { Server } from 'socket.io';
import { verifySocketToken } from './auth';

export const initScoreSocket = (io: Server) => {
  const score = io.of('/score');

  score.use((socket, next) => {
    try {
      verifySocketToken(socket);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  score.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });
};
