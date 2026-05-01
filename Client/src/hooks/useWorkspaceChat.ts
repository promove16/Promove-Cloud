import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';
import { getChatSocket } from '../lib/socket';
import { ChatMessage } from '../types/workspace.types';

interface MessageStatus {
  deliveredAt?: string;
  seenAt?: string;
  seenBy?: string[];
}

export const useWorkspaceChat = (workspaceId?: string) => {
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [messageStatus, setMessageStatus] = useState<Map<string, MessageStatus>>(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveredMessageIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

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

    const handleDelivered = ({ messageId, deliveredAt }: { messageId: string; deliveredAt: string }) => {
      setMessageStatus((current) => {
        const next = new Map(current);
        const existing = next.get(messageId) || {};
        next.set(messageId, { ...existing, deliveredAt });
        return next;
      });
      setLiveMessages((current) =>
        current.map((msg) => (msg._id === messageId ? { ...msg, deliveredAt } : msg)),
      );
    };

    const handleSeen = ({ messageId, seenAt, seenBy }: { messageId: string; seenAt: string; seenBy: string[] }) => {
      setMessageStatus((current) => {
        const next = new Map(current);
        const existing = next.get(messageId) || {};
        next.set(messageId, { ...existing, seenAt, seenBy });
        return next;
      });
      // Also update the message in liveMessages to reflect seen status
      setLiveMessages((current) =>
        current.map((msg) =>
          msg._id === messageId ? { ...msg, seenAt, seenBy } : msg,
        ),
      );
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:list', handlePresenceList);
    socket.on('chat:delivered', handleDelivered);
    socket.on('chat:seen', handleSeen);

    return () => {
      socket.emit('chat:leave', { workspaceId });
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:list', handlePresenceList);
      socket.off('chat:delivered', handleDelivered);
      socket.off('chat:seen', handleSeen);
      socket.disconnect();
      setLiveMessages([]);
      setTypingUsers(new Set());
      setOnlineUserIds(new Set());
      setMessageStatus(new Map());
      deliveredMessageIdsRef.current.clear();
      seenMessageIdsRef.current.clear();
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!historyQuery.data?.length) {
      return;
    }

    setMessageStatus((current) => {
      const next = new Map(current);
      historyQuery.data.forEach((message) => {
        if (!message.deliveredAt && !message.seenAt && !message.seenBy?.length) {
          return;
        }

        next.set(message._id, {
          deliveredAt: message.deliveredAt,
          seenAt: message.seenAt,
          seenBy: message.seenBy,
        });
      });
      return next;
    });
  }, [historyQuery.data]);

  const messages = useMemo(() => {
    const merged = new Map<string, ChatMessage>();

    for (const message of historyQuery.data ?? []) {
      merged.set(message._id, message);
    }

    for (const message of liveMessages) {
      const existing = merged.get(message._id);
      merged.set(message._id, existing ? { ...existing, ...message } : message);
    }

    return [...merged.values()].sort(
      (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
    );
  }, [historyQuery.data, liveMessages]);

  const sendMessage = (payload: {
    workspaceId: string;
    message: string;
    attachmentUrl?: string;
    attachmentType?: ChatMessage['attachmentType'];
    attachmentName?: string;
    attachmentSizeBytes?: number;
    attachmentMimeType?: string;
    attachmentUploadId?: string;
    codeSnippet?: ChatMessage['codeSnippet'];
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

  const markDelivered = useCallback((messageId: string) => {
    if (!workspaceId) return;
    const socket = getChatSocket();
    if (!socket.connected) return;
    if (deliveredMessageIdsRef.current.has(messageId)) return;
    deliveredMessageIdsRef.current.add(messageId);
    socket.emit('chat:delivered', { workspaceId, messageId });
  }, [workspaceId]);

  const markSeen = useCallback((messageId: string) => {
    if (!workspaceId) return;
    const socket = getChatSocket();
    if (!socket.connected) return;
    if (seenMessageIdsRef.current.has(messageId)) return;
    seenMessageIdsRef.current.add(messageId);
    socket.emit('chat:seen', { workspaceId, messageId });
  }, [workspaceId]);

  return {
    ...historyQuery,
    messages,
    sendMessage,
    sendTyping,
    markDelivered,
    markSeen,
    typingUsers,
    onlineUserIds,
    messageStatus,
  };
};
