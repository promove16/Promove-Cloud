import { io } from '../../config/socket';
import { emitActivity } from '../../sockets/bidSocket';

export interface BroadcastActivityInput {
  startupId: string;
  action: string;
  actorName?: string;
  actorAvatar?: string;
  summary?: string;
}

export const broadcastStartupActivity = (input: BroadcastActivityInput) => {
  emitActivity(io, input.startupId, {
    startupId: input.startupId,
    action: input.action,
    actorName: input.actorName ?? 'Someone',
    actorAvatar: input.actorAvatar,
    summary: input.summary ?? input.action.replaceAll('_', ' ').toLowerCase(),
    at: new Date().toISOString(),
  });
};
