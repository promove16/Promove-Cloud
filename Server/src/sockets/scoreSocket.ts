import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../types/roles.types';

export const initScoreSocket = (io: Server) => {
  const score = io.of('/score');

  score.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as any;
      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      socket.data.institutionId = decoded.institutionId ?? null;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  score.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    if ([UserRole.SCHOOL, UserRole.COLLEGE].includes(socket.data.role)) {
      socket.join(`institution:${userId}`);
    }

    if (socket.data.institutionId) {
      socket.join(`institution:${socket.data.institutionId}`);
    }

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
      socket.leave(`institution:${userId}`);
      if (socket.data.institutionId) {
        socket.leave(`institution:${socket.data.institutionId}`);
      }
    });
  });
};
