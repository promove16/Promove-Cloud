import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi, DMMessage, DMPartner, QueryType } from '../api/dm.api';
import { getDmSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';

const normalizeQueryType = (queryType?: QueryType) => queryType ?? 'general';

const isSameAttachment = (left: DMMessage, right: DMMessage) => {
  if (left.attachmentStorageKey && right.attachmentStorageKey) {
    return left.attachmentStorageKey === right.attachmentStorageKey;
  }

  if (left.attachmentStorageKey || right.attachmentStorageKey) {
    return (
      left.attachmentType === right.attachmentType &&
      left.attachmentName === right.attachmentName
    );
  }

  return (
    left.attachmentUrl === right.attachmentUrl &&
    left.attachmentType === right.attachmentType &&
    left.attachmentName === right.attachmentName
  );
};

const isSameOutgoingMessage = (left: DMMessage, right: DMMessage) =>
  left.senderId === right.senderId &&
  left.recipientId === right.recipientId &&
  left.message === right.message &&
  left.messageType === right.messageType &&
  normalizeQueryType(left.queryType) === normalizeQueryType(right.queryType) &&
  left.scheduledAt === right.scheduledAt &&
  left.meetLink === right.meetLink &&
  isSameAttachment(left, right);

export const useDM = (partnerId?: string) => {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [liveMessages, setLiveMessages] = useState<DMMessage[]>([]);
  const [typingFromPartner, setTypingFromPartner] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedReadKey = useRef<string | null>(null);
  
  // Use ref to always get the current partnerId, preventing stale closures
  const partnerIdRef = useRef<string | undefined>(partnerId);
  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  const markThreadAsRead = useCallback(
    (targetPartnerId: string, marker: string) => {
      const readKey = `${targetPartnerId}:${marker}`;
      if (lastMarkedReadKey.current === readKey) return;
      lastMarkedReadKey.current = readKey;

      const socket = getDmSocket();
      if (!socket.connected) socket.connect();
      socket.emit('dm:read', { partnerId: targetPartnerId });

      dmApi
        .markAsRead(targetPartnerId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
        })
        .catch(() => {
          if (lastMarkedReadKey.current === readKey) {
            lastMarkedReadKey.current = null;
          }
        });
    },
    [queryClient],
  );

  // Fetch thread history
  const threadQuery = useQuery({
    queryKey: ['dm', 'thread', partnerId],
    queryFn: () => dmApi.getThread(partnerId!),
    enabled: Boolean(partnerId),
  });

  // Fetch partner profile (for new conversations not in the list)
  const partnerQuery = useQuery({
    queryKey: ['dm', 'partner', partnerId],
    queryFn: () => dmApi.getPartnerProfile(partnerId!),
    enabled: Boolean(partnerId),
    staleTime: 60_000,
  });

  // Connect socket and handle events
  useEffect(() => {
    const socket = getDmSocket();
    if (!socket.connected) socket.connect();

    const handleMessage = (msg: DMMessage) => {
      // Use ref to get current partnerId
      const currentPartnerId = partnerIdRef.current;
      
      // Only process messages for the current conversation
      const isRelevant = currentPartnerId && (
        msg.senderId === currentPartnerId || 
        msg.recipientId === currentPartnerId
      );

      if (isRelevant) {
        setLiveMessages((cur) => {
          const withoutMatchingOptimistic = cur.filter(
            (message) => !(message.isOptimistic && isSameOutgoingMessage(message, msg)),
          );
          return withoutMatchingOptimistic.some((message) => message._id === msg._id)
            ? withoutMatchingOptimistic
            : [...withoutMatchingOptimistic, msg];
        });
      }

      // Always invalidate conversations list to refresh unread counts
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    };

    const handleTyping = ({ senderId, isTyping }: { senderId: string; isTyping: boolean }) => {
      const currentPartnerId = partnerIdRef.current;
      if (senderId !== currentPartnerId) return;
      setTypingFromPartner(isTyping);
      if (isTyping) {
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingFromPartner(false), 3000);
      }
    };

    // Online/offline presence
    const handlePresence = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['dm', 'partner'] });
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    };

    // Messages read notification from partner
    const handleMessagesRead = ({ readBy, readAt }: { readBy: string; readAt: string }) => {
      const currentPartnerId = partnerIdRef.current;
      if (readBy !== currentPartnerId) return;
      
      setLiveMessages((cur) =>
        cur.map((m) =>
          m.senderId === currentUserId && m.recipientId === readBy && !m.readAt
            ? { ...m, readAt }
            : m,
        ),
      );
      queryClient.setQueryData<DMMessage[] | undefined>(
        ['dm', 'thread', currentPartnerId],
        (current) =>
          current?.map((m) =>
            m.senderId === currentUserId && m.recipientId === readBy && !m.readAt
              ? { ...m, readAt }
              : m,
          ),
      );
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    };

    const handleError = (error: { message: string }) => {
      console.error('[DM Socket Error]', error.message);
    };

    socket.on('dm:message', handleMessage);
    socket.on('dm:typing', handleTyping);
    socket.on('dm:presence', handlePresence);
    socket.on('dm:messages-read', handleMessagesRead);
    socket.on('dm:error', handleError);

    return () => {
      socket.off('dm:message', handleMessage);
      socket.off('dm:typing', handleTyping);
      socket.off('dm:presence', handlePresence);
      socket.off('dm:messages-read', handleMessagesRead);
      socket.off('dm:error', handleError);
    };
  }, [currentUserId, queryClient]);

  // Clear live messages when partner changes
  useEffect(() => {
    setLiveMessages([]);
  }, [partnerId]);

  // Merge history + live, deduplicate
  const messages = (() => {
    const all = [...(threadQuery.data ?? []), ...liveMessages];
    const seen = new Set<string>();
    return all
      .filter((m) => {
        if (seen.has(m._id)) return false;
        seen.add(m._id);
        return true;
      })
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  })();

  const latestUnreadIncomingMessageId = partnerId
    ? [...messages]
        .reverse()
        .find((message) => message.senderId === partnerId && !message.readAt)?._id
    : undefined;

  useEffect(() => {
    if (!partnerId || !latestUnreadIncomingMessageId) return;
    markThreadAsRead(partnerId, latestUnreadIncomingMessageId);
  }, [latestUnreadIncomingMessageId, markThreadAsRead, partnerId]);

  // Secure send - use ref for current partnerId
  const sendMessage = useCallback(
    (payload: { message?: string; messageType?: 'text' | 'interview_request'; scheduledAt?: string; meetLink?: string; queryType?: QueryType; attachmentUrl?: string; attachmentType?: 'image' | 'pdf'; attachmentName?: string; attachmentStorageProvider?: 'cloudinary' | 's3'; attachmentStorageKey?: string }) => {
      const currentPartnerId = partnerIdRef.current;
      if (!currentPartnerId) {
        console.error('[DM] Cannot send: no partnerId');
        return;
      }

      if (currentUserId) {
        const optimisticMessage: DMMessage = {
          _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: currentUserId,
          recipientId: currentPartnerId,
          message: payload.message ?? '',
          messageType: payload.messageType ?? 'text',
          queryType: normalizeQueryType(payload.queryType),
          scheduledAt: payload.scheduledAt,
          meetLink: payload.meetLink,
          attachmentUrl: payload.attachmentUrl,
          attachmentType: payload.attachmentType,
          attachmentName: payload.attachmentName,
          attachmentStorageProvider: payload.attachmentStorageProvider,
          attachmentStorageKey: payload.attachmentStorageKey,
          readAt: null,
          sentAt: new Date().toISOString(),
          isOptimistic: true,
        };
        setLiveMessages((cur) => [...cur, optimisticMessage]);
      }
      
      const socket = getDmSocket();
      if (!socket.connected) socket.connect();
      
      // Always use the CURRENT partnerId from ref
      socket.emit('dm:send', { recipientId: currentPartnerId, ...payload });
      console.log(`[DM] Sending to ${currentPartnerId}:`, payload.message?.substring(0, 50));
    },
    [currentUserId],
  );

  const sendTyping = useCallback(() => {
    const currentPartnerId = partnerIdRef.current;
    if (!currentPartnerId) return;
    
    const socket = getDmSocket();
    if (!socket.connected) return;
    
    socket.emit('dm:typing', { recipientId: currentPartnerId, isTyping: true });
    if (typingDebounce.current) clearTimeout(typingDebounce.current);
    typingDebounce.current = setTimeout(() => {
      socket.emit('dm:typing', { recipientId: currentPartnerId, isTyping: false });
    }, 1500);
  }, []);

  const clearLive = useCallback(() => setLiveMessages([]), []);

  const isPartnerOnline = partnerId
    ? onlineUsers.has(partnerId) || partnerQuery.data?.isOnline === true
    : false;

  return {
    ...threadQuery,
    messages,
    sendMessage,
    sendTyping,
    typingFromPartner,
    clearLive,
    partner: partnerQuery.data as DMPartner | undefined,
    isPartnerOnline,
    onlineUsers,
  };
};
