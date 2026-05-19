import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { interestApi, StartupInterestSummary } from '../api/interest.api';
import { getBidSocket } from '../lib/socket';

const interestSummaryKey = (startupId: string) => ['interest', 'summary', startupId] as const;

export const useStartupInterest = (startupId: string | null | undefined) => {
  const queryClient = useQueryClient();

  const summaryQuery = useQuery<StartupInterestSummary>({
    queryKey: interestSummaryKey(startupId ?? 'noop'),
    enabled: !!startupId,
    queryFn: async () => {
      if (!startupId) {
        return { interestedCount: 0, isInterested: false };
      }
      const res = await interestApi.summary(startupId);
      return res.data.data;
    },
  });

  const setSummary = useCallback(
    (updater: (prev: StartupInterestSummary) => StartupInterestSummary) => {
      if (!startupId) return;
      queryClient.setQueryData<StartupInterestSummary>(
        interestSummaryKey(startupId),
        (prev) =>
          updater(prev ?? { interestedCount: 0, isInterested: false }),
      );
    },
    [queryClient, startupId],
  );

  const expressMutation = useMutation({
    mutationFn: async (message?: string) => {
      if (!startupId) throw new Error('startupId required');
      const res = await interestApi.express(startupId, message ? { message } : undefined);
      return res.data.data;
    },
    onMutate: () => {
      setSummary((prev) => ({
        ...prev,
        isInterested: true,
        interestedCount: prev.interestedCount + (prev.isInterested ? 0 : 1),
      }));
    },
    onSuccess: (data) => {
      setSummary((prev) => ({
        ...prev,
        isInterested: true,
        interestId: data._id,
        interestedAt: data.createdAt,
      }));
      toast.success('Interest expressed — bidding unlocked.');
    },
    onError: (err: unknown) => {
      summaryQuery.refetch();
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not express interest';
      toast.error(message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!startupId) throw new Error('startupId required');
      const res = await interestApi.withdraw(startupId);
      return res.data.data;
    },
    onMutate: () => {
      setSummary((prev) => ({
        ...prev,
        isInterested: false,
        interestId: undefined,
        interestedCount: Math.max(0, prev.interestedCount - (prev.isInterested ? 1 : 0)),
      }));
    },
    onSuccess: () => {
      toast.message('Interest withdrawn.');
    },
    onError: (err: unknown) => {
      summaryQuery.refetch();
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not withdraw interest';
      toast.error(message);
    },
  });

  // Live updates: subscribe to startup room and update count when other investors
  // express/withdraw interest.
  useEffect(() => {
    if (!startupId) return undefined;

    const socket = getBidSocket();
    if (!socket.connected) socket.connect();

    const join = () => socket.emit('bid:join-startup', { startupId });
    join();
    socket.on('connect', join);

    const onExpressed = (data: { startupId: string; interestedCount?: number }) => {
      if (data.startupId !== startupId) return;
      setSummary((prev) => ({
        ...prev,
        interestedCount: data.interestedCount ?? prev.interestedCount + 1,
      }));
    };
    const onWithdrawn = (data: { startupId: string; interestedCount?: number }) => {
      if (data.startupId !== startupId) return;
      setSummary((prev) => ({
        ...prev,
        interestedCount:
          data.interestedCount ?? Math.max(0, prev.interestedCount - 1),
      }));
    };

    socket.on('interest:expressed', onExpressed);
    socket.on('interest:withdrawn', onWithdrawn);

    return () => {
      socket.off('connect', join);
      socket.off('interest:expressed', onExpressed);
      socket.off('interest:withdrawn', onWithdrawn);
      socket.emit('bid:leave-startup', { startupId });
    };
  }, [startupId, setSummary]);

  return {
    summary: summaryQuery.data ?? { interestedCount: 0, isInterested: false },
    isLoading: summaryQuery.isLoading,
    isFetching: summaryQuery.isFetching,
    refetch: summaryQuery.refetch,
    expressInterest: expressMutation.mutate,
    expressInterestAsync: expressMutation.mutateAsync,
    isExpressing: expressMutation.isPending,
    withdrawInterest: withdrawMutation.mutate,
    isWithdrawing: withdrawMutation.isPending,
  };
};
