import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { activityApi, ActivityFeedItem } from '../../api/activity.api';
import { getBidSocket } from '../../lib/socket';

const actionColors: Record<string, string> = {
  INTEREST_EXPRESSED: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  INTEREST_WITHDRAWN: 'border-slate-700 bg-slate-900 text-slate-400',
  BID_PLACED: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  BID_ACCEPTED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  BID_REJECTED: 'border-red-500/30 bg-red-500/10 text-red-300',
  BID_EXPIRED: 'border-slate-700 bg-slate-900 text-slate-400',
  DEAL_CREATED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

const actionLabel = (action: string) =>
  action
    .split('_')
    .join(' ')
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

const formatTimeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

type Props = {
  startupId: string;
  className?: string;
  maxItems?: number;
};

export const LiveActivityFeed = ({ startupId, className, maxItems = 30 }: Props) => {
  const queryClient = useQueryClient();

  const query = useQuery<ActivityFeedItem[]>({
    queryKey: ['activity-feed', startupId],
    enabled: !!startupId,
    queryFn: async () => {
      const res = await activityApi.forStartup(startupId, maxItems);
      return res.data.data.items;
    },
  });

  useEffect(() => {
    if (!startupId) return undefined;
    const socket = getBidSocket();
    if (!socket.connected) socket.connect();

    const join = () => socket.emit('bid:join-startup', { startupId });
    join();
    socket.on('connect', join);

    const onActivity = (data: {
      startupId: string;
      action: string;
      actorName?: string;
      actorAvatar?: string;
      summary?: string;
      at: string;
    }) => {
      if (data.startupId !== startupId) return;
      const ephemeralItem: ActivityFeedItem = {
        _id: `live-${data.at}-${Math.random().toString(36).slice(2, 7)}`,
        action: data.action,
        entityType: 'Startup',
        entityId: startupId,
        actorName: data.actorName ?? 'Someone',
        actorAvatar: data.actorAvatar,
        summary: data.summary ?? actionLabel(data.action),
        createdAt: data.at,
      };
      queryClient.setQueryData<ActivityFeedItem[]>(
        ['activity-feed', startupId],
        (prev) => [ephemeralItem, ...(prev ?? [])].slice(0, maxItems),
      );
    };

    socket.on('activity:new', onActivity);
    return () => {
      socket.off('connect', join);
      socket.off('activity:new', onActivity);
    };
  }, [startupId, queryClient, maxItems]);

  const items = query.data ?? [];

  return (
    <Card className={className ? `${className} p-5` : 'p-5'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Live Investor Activity
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {items.length === 0 ? 'No activity yet' : `${items.length} recent events`}
          </div>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
        </span>
      </div>

      {query.isLoading ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-800/40" />
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-400">
          Activity will appear here as investors interact with this startup.
        </div>
      ) : (
        <div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item._id}
              className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-cyan-300">
                {(item.actorName ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={actionColors[item.action] ?? actionColors.BID_PLACED}>
                    {actionLabel(item.action)}
                  </Badge>
                  <span className="text-xs text-slate-500">{formatTimeAgo(item.createdAt)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-200">{item.summary}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default LiveActivityFeed;
