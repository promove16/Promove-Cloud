import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './env';
import { initChatSocket } from '../sockets/chatSocket';
import { initNotificationSocket } from '../sockets/notificationSocket';
import { initScoreSocket } from '../sockets/scoreSocket';

export let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 30000,
  });

  initScoreSocket(io);
  initChatSocket(io);
  initNotificationSocket(io);

  return io;
};
