import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scoreApi } from '../api/score.api';
import { getScoreSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { ScoreResponse, ScoreUpdatedEvent } from '../types/score.types';

export const useInnovationScore = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: ['score', 'me'],
    queryFn: () => scoreApi.getMyScore(),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const socket = getScoreSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleUpdate = (data: ScoreUpdatedEvent) => {
      queryClient.setQueryData<ScoreResponse | undefined>(['score', 'me'], (previous) =>
        previous
          ? {
              ...previous,
              score: data.newScore,
            }
          : previous,
      );
    };

    socket.on('score:updated', handleUpdate);

    return () => {
      socket.off('score:updated', handleUpdate);
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient]);

  return query;
};
