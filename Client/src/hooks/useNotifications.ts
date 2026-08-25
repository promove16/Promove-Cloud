import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api/notification.api';
import { getNotifSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { NotificationItem } from '../types/notification.types';

type HiringUpdatePayload = {
  action: 'apply' | 'invite' | 'invite_accept' | 'invite_decline' | 'stage_update';
  jobId?: string;
  studentId?: string;
  recruiterId?: string;
  stage?: string;
};

const HIRING_INVALIDATION_KEYS: ReadonlyArray<readonly unknown[]> = [
  ['student', 'applications'],
  ['requests'],
  ['recruiter', 'jobs'],
  ['recruiter', 'job-applications'],
  ['recruiter', 'job-applications-fallback'],
  ['recruiter', 'dashboard'],
  ['recruiter', 'onboarding'],
  ['recruiter', 'talent'],
  ['recruiter', 'placements'],
  ['college-placement'],
];

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const socket = getNotifSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleNotification = (notification: NotificationItem) => {
      queryClient.setQueryData<NotificationItem[] | undefined>(['notifications'], (current) => [
        notification,
        ...(current ?? []),
      ]);
    };

    const handleHiringUpdate = (_payload: HiringUpdatePayload) => {
      for (const queryKey of HIRING_INVALIDATION_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

    socket.on('notification:new', handleNotification);
    socket.on('hiring:updated', handleHiringUpdate);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('hiring:updated', handleHiringUpdate);
    };
  }, [isAuthenticated, queryClient]);

  const unreadCount = (query.data ?? []).filter((item) => !item.isRead).length;

  return {
    ...query,
    unreadCount,
  };
};
