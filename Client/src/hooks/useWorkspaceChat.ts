import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';
import { getChatSocket } from '../lib/socket';
import { ChatMessage } from '../types/workspace.types';

export const useWorkspaceChat = (workspaceId?: string) => {
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);

  const historyQuery = useQuery({
    queryKey: ['workspace', workspaceId, 'chat'],
    queryFn: () => chatApi.getHistory(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    const socket = getChatSocket();
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('chat:join', { workspaceId });

    const handleMessage = (message: ChatMessage) => {
      if (message.workspaceId === workspaceId) {
        setLiveMessages((current) =>
          current.some((item) => item._id === message._id) ? current : [...current, message],
        );
      }
    };

    socket.on('chat:message', handleMessage);

    return () => {
      socket.emit('chat:leave', { workspaceId });
      socket.off('chat:message', handleMessage);
      socket.disconnect();
      setLiveMessages([]);
    };
  }, [workspaceId]);

  const messages = useMemo(() => {
    const combined = [...(historyQuery.data ?? []), ...liveMessages];
    return [...combined].sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime());
  }, [historyQuery.data, liveMessages]);

  const sendMessage = (payload: {
    workspaceId: string;
    message: string;
    attachmentUrl?: string;
    attachmentType?: 'pdf' | 'image';
  }) => {
    const socket = getChatSocket();
    if (!socket.connected) {
      socket.connect();
      socket.emit('chat:join', { workspaceId: payload.workspaceId });
    }
    socket.emit('chat:message', payload);
  };

  return {
    ...historyQuery,
    messages,
    sendMessage,
  };
};
