import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi, DMMessage, DMPartner } from '../api/dm.api';
import { getDmSocket } from '../lib/socket';

export const useDM = (partnerId?: string) => {
  const queryClient = useQueryClient();
  const [liveMessages, setLiveMessages] = useState<DMMessage[]>([]);
  const [typingFromPartner, setTypingFromPartner] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const isRelevant =
        partnerId &&
        ((msg.senderId === partnerId) || (msg.recipientId === partnerId));

      if (isRelevant) {
        setLiveMessages((cur) =>
          cur.some((m) => m._id === msg._id) ? cur : [...cur, msg],
        );
      }

      // Invalidate conversations list so unread counts refresh
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    };

    const handleTyping = ({ senderId, isTyping }: { senderId: string; isTyping: boolean }) => {
      if (senderId !== partnerId) return;
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
      // Also refresh partner query and conversations
      queryClient.invalidateQueries({ queryKey: ['dm', 'partner'] });
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
    };

    // Messages read notification from partner
    const handleMessagesRead = ({ readBy, readAt }: { readBy: string; readAt: string }) => {
      if (readBy !== partnerId) return;
      // Update live messages that were sent by current user to mark them as read
      setLiveMessages((cur) =>
        cur.map((m) =>
          m.recipientId === readBy && !m.readAt
            ? { ...m, readAt }
            : m,
        ),
      );
      // Refresh thread to get updated readAt from server
      queryClient.invalidateQueries({ queryKey: ['dm', 'thread', partnerId] });
    };

    socket.on('dm:message', handleMessage);
    socket.on('dm:typing', handleTyping);
    socket.on('dm:presence', handlePresence);
    socket.on('dm:messages-read', handleMessagesRead);

    return () => {
      socket.off('dm:message', handleMessage);
      socket.off('dm:typing', handleTyping);
      socket.off('dm:presence', handlePresence);
      socket.off('dm:messages-read', handleMessagesRead);
    };
  }, [partnerId, queryClient]);

  // Auto-mark messages as read when thread is opened
  useEffect(() => {
    if (!partnerId) return;
    const socket = getDmSocket();
    if (socket.connected) {
      socket.emit('dm:read', { partnerId });
    }
    // Also mark via REST for reliability
    dmApi.markAsRead(partnerId).catch(() => {});
  }, [partnerId, threadQuery.data]);

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

  const sendMessage = useCallback(
    (payload: { message?: string; messageType?: 'text' | 'interview_request'; scheduledAt?: string; meetLink?: string }) => {
      if (!partnerId) return;
      const socket = getDmSocket();
      if (!socket.connected) socket.connect();
      socket.emit('dm:send', { recipientId: partnerId, ...payload });
    },
    [partnerId],
  );

  const sendTyping = useCallback(() => {
    if (!partnerId) return;
    const socket = getDmSocket();
    if (!socket.connected) return;
    socket.emit('dm:typing', { recipientId: partnerId, isTyping: true });
    if (typingDebounce.current) clearTimeout(typingDebounce.current);
    typingDebounce.current = setTimeout(() => {
      socket.emit('dm:typing', { recipientId: partnerId, isTyping: false });
    }, 1500);
  }, [partnerId]);

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
