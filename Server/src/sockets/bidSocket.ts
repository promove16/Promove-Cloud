import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const onlineUsers = new Map<string, Set<string>>();

export const initBidSocket = (io: Server) => {
  const bids = io.of('/bids');

  bids.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as any;
      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  bids.on('connection', (socket) => {
    const userId: string = socket.data.userId;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    socket.on('bid:join-startup', (data: { startupId: string }) => {
      if (!data?.startupId) return;
      socket.join(`startup:${data.startupId}`);
    });

    socket.on('bid:leave-startup', (data: { startupId: string }) => {
      if (!data?.startupId) return;
      socket.leave(`startup:${data.startupId}`);
    });

    socket.on('bid:join-my-bids', () => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });

  return bids;
};

export const emitBidUpdate = (io: Server, startupId: string, event: string, data: unknown) => {
  io.of('/bids').to(`startup:${startupId}`).emit(event, data);
};

export const emitUserBidUpdate = (io: Server, userId: string, event: string, data: unknown) => {
  io.of('/bids').to(`user:${userId}`).emit(event, data);
};

export const emitBidPlaced = (io: Server, startupId: string, bidData: Record<string, unknown>) => {
  emitBidUpdate(io, startupId, 'bid:placed', bidData);
};

export const emitBidUpdated = (io: Server, startupId: string, bidData: Record<string, unknown>) => {
  emitBidUpdate(io, startupId, 'bid:updated', bidData);
};

export const emitBidCountered = (io: Server, startupId: string, bidData: Record<string, unknown>) => {
  emitBidUpdate(io, startupId, 'bid:countered', bidData);
};

export const emitBidAccepted = (io: Server, startupId: string, bidData: Record<string, unknown>) => {
  emitBidUpdate(io, startupId, 'bid:accepted', bidData);
  if (bidData.investorId) {
    emitUserBidUpdate(io, String(bidData.investorId), 'bid:accepted', bidData);
  }
};

export const emitBidRejected = (io: Server, startupId: string, bidData: Record<string, unknown>) => {
  emitBidUpdate(io, startupId, 'bid:rejected', bidData);
  if (bidData.investorId) {
    emitUserBidUpdate(io, String(bidData.investorId), 'bid:rejected', bidData);
  }
};

export const emitInterestExpressed = (
  io: Server,
  startupId: string,
  data: Record<string, unknown>,
) => {
  emitBidUpdate(io, startupId, 'interest:expressed', data);
};

export const emitInterestWithdrawn = (
  io: Server,
  startupId: string,
  data: Record<string, unknown>,
) => {
  emitBidUpdate(io, startupId, 'interest:withdrawn', data);
};

export const emitFundingUpdated = (
  io: Server,
  startupId: string,
  data: Record<string, unknown>,
) => {
  emitBidUpdate(io, startupId, 'funding:updated', data);
};

export const emitActivity = (
  io: Server,
  startupId: string,
  data: Record<string, unknown>,
) => {
  emitBidUpdate(io, startupId, 'activity:new', data);
};
