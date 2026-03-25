import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { UserRole } from '../types/roles.types';

interface MentorSocketPayload extends jwt.JwtPayload {
  _id: string;
  role: UserRole;
  email: string;
  type: 'access';
}

export const initMentorSocket = (io: Server) => {
  const mentor = io.of('/mentor');

  mentor.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as MentorSocketPayload;
      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  mentor.on('connection', (socket) => {
    socket.join(`mentor:${socket.data.userId}`);

    socket.on('mentor:watch', async ({ studentId }: { studentId: string }) => {
      socket.join(`student-feed:${studentId}`);
      await redis.sadd(`mentor:watch:${socket.data.userId}`, studentId);
      await redis.sadd(`student:watchers:${studentId}`, socket.data.userId);
    });

    socket.on('mentor:unwatch', async ({ studentId }: { studentId: string }) => {
      socket.leave(`student-feed:${studentId}`);
      await redis.srem(`mentor:watch:${socket.data.userId}`, studentId);
      await redis.srem(`student:watchers:${studentId}`, socket.data.userId);
    });

    socket.on('disconnect', () => {
      socket.leave(`mentor:${socket.data.userId}`);
    });
  });
};
