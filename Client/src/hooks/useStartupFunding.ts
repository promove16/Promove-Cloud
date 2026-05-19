import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fundingApi, FundingSnapshot } from '../api/funding.api';
import { getBidSocket } from '../lib/socket';

const fundingKey = (startupId: string) => ['funding', 'snapshot', startupId] as const;

export const useStartupFunding = (startupId: string | null | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery<FundingSnapshot>({
    queryKey: fundingKey(startupId ?? 'noop'),
    enabled: !!startupId,
    queryFn: async () => {
      if (!startupId) throw new Error('startupId required');
      const res = await fundingApi.snapshot(startupId);
      return res.data.data;
    },
  });

  const setSnapshot = useCallback(
    (snapshot: FundingSnapshot) => {
      if (!startupId) return;
      queryClient.setQueryData(fundingKey(startupId), snapshot);
    },
    [queryClient, startupId],
  );

  useEffect(() => {
    if (!startupId) return undefined;

    const socket = getBidSocket();
    if (!socket.connected) socket.connect();

    const join = () => socket.emit('bid:join-startup', { startupId });
    join();
    socket.on('connect', join);

    const onUpdate = (data: FundingSnapshot) => {
      if (data.startupId !== startupId) return;
      setSnapshot(data);
    };
    socket.on('funding:updated', onUpdate);

    return () => {
      socket.off('connect', join);
      socket.off('funding:updated', onUpdate);
    };
  }, [startupId, setSnapshot]);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};
