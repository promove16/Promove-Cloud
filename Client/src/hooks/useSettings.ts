import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { settingsApi } from '../api/settings.api';
import type { SettingsUpdate, UserSettings } from '../types/settings.types';
import { useAuthStore } from '../store/authStore';

export function useSettings() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const canQuerySettings = !isAuthLoading && isAuthenticated;

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    enabled: canQuerySettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        return false;
      }

      return failureCount < 1;
    },
  });

  const mutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData<UserSettings>(['settings'], updated);
    },
  });

  return {
    settings: query.data,
    isLoading: isAuthLoading || (canQuerySettings && query.isLoading),
    isError: query.isError,
    updateSettings: mutation.mutate,
    updateSettingsAsync: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
}
