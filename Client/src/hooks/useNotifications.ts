import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api/notification.api';
import { getNotifSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { NotificationItem } from '../types/notification.types';

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

    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient]);

  const unreadCount = (query.data ?? []).filter((item) => !item.isRead).length;

  return {
    ...query,
    unreadCount,
  };
};
