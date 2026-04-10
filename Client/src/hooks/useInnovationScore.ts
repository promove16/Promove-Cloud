import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scoreApi } from '../api/score.api';
import { getScoreSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { ScoreResponse, ScoreUpdatedEvent } from '../types/score.types';

interface UseInnovationScoreOptions {
  enabled?: boolean;
}

export const useInnovationScore = ({ enabled = true }: UseInnovationScoreOptions = {}) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const canFetchScore = isAuthenticated && enabled;

  const query = useQuery({
    queryKey: ['score', 'me'],
    queryFn: () => scoreApi.getMyScore(),
    staleTime: 5 * 60 * 1000,
    enabled: canFetchScore,
  });

  useEffect(() => {
    if (!canFetchScore) {
      return;
    }

    const socket = getScoreSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleUpdate = (data: ScoreUpdatedEvent) => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.innovationScore !== data.newScore) {
        setUser({ ...currentUser, innovationScore: data.newScore });
      }

      queryClient.setQueryData<ScoreResponse | undefined>(['score', 'me'], (previous) =>
        previous
          ? {
              ...previous,
              score: data.newScore,
            }
          : previous,
      );

      void queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['score', 'history', 'me'] });
    };

    socket.on('score:updated', handleUpdate);

    return () => {
      socket.off('score:updated', handleUpdate);
      socket.disconnect();
    };
  }, [canFetchScore, queryClient, setUser]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!authUser || query.data?.score === undefined || authUser.innovationScore === query.data.score) {
      return;
    }

    setUser({ ...authUser, innovationScore: query.data.score });
  }, [authUser, enabled, query.data?.score, setUser]);

  return query;
};
