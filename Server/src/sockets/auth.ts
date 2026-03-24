import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { env } from '../config/env';
import { UserRole } from '../types/roles.types';

interface SocketPayload extends jwt.JwtPayload {
  _id: string;
  role: UserRole;
  email: string;
}

export const verifySocketToken = (socket: Socket) => {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    throw new Error('Unauthorized');
  }

  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['RS256'],
  }) as SocketPayload;

  socket.data.userId = decoded._id;
  socket.data.role = decoded.role;
  socket.data.email = decoded.email;
};
