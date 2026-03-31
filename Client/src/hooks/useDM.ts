import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi, DMMessage } from '../api/dm.api';
import { getDmSocket } from '../lib/socket';

export const useDM = (partnerId?: string) => {
  const queryClient = useQueryClient();
  const [liveMessages, setLiveMessages] = useState<DMMessage[]>([]);
  const [typingFromPartner, setTypingFromPartner] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch thread history
  const threadQuery = useQuery({
    queryKey: ['dm', 'thread', partnerId],
    queryFn: () => dmApi.getThread(partnerId!),
    enabled: Boolean(partnerId),
  });

  // Connect socket once per session
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

    socket.on('dm:message', handleMessage);
    socket.on('dm:typing', handleTyping);

    return () => {
      socket.off('dm:message', handleMessage);
      socket.off('dm:typing', handleTyping);
    };
  }, [partnerId, queryClient]);

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

  return {
    ...threadQuery,
    messages,
    sendMessage,
    sendTyping,
    typingFromPartner,
    clearLive,
  };
};
