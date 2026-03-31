import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';
import { getChatSocket } from '../lib/socket';
import { ChatMessage } from '../types/workspace.types';

export const useWorkspaceChat = (workspaceId?: string) => {
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const handleTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((current) => {
        const next = new Set(current);
        if (isTyping) {
          next.add(userId);
          // Auto-clear if server stops broadcasting
          const existing = typingTimers.current.get(userId);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setTypingUsers((s) => {
              const n = new Set(s);
              n.delete(userId);
              return n;
            });
          }, 3000);
          typingTimers.current.set(userId, timer);
        } else {
          next.delete(userId);
          const existing = typingTimers.current.get(userId);
          if (existing) clearTimeout(existing);
          typingTimers.current.delete(userId);
        }
        return next;
      });
    };

    const handlePresenceUpdate = ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const handlePresenceList = ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(ids));
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:list', handlePresenceList);

    return () => {
      socket.emit('chat:leave', { workspaceId });
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:list', handlePresenceList);
      socket.disconnect();
      setLiveMessages([]);
      setTypingUsers(new Set());
      setOnlineUserIds(new Set());
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
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

  // Call this on every keystroke in the chat input
  const sendTyping = useCallback(() => {
    if (!workspaceId) return;
    const socket = getChatSocket();
    if (!socket.connected) return;

    socket.emit('chat:typing', { workspaceId, isTyping: true });

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socket.emit('chat:typing', { workspaceId, isTyping: false });
    }, 1500);
  }, [workspaceId]);

  return {
    ...historyQuery,
    messages,
    sendMessage,
    sendTyping,
    typingUsers,
    onlineUserIds,
  };
};
