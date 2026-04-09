import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle,
  Search,
  Send,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Clock,
  Video,
  X,
  PenSquare,
  Users,
  Check,
  CheckCheck,
  FileText,
} from 'lucide-react';
import { dmApi, DMConversation, DMMessage } from '../../api/dm.api';
import { getConversationPreviewText } from '../../components/messaging/conversationPreview';
import { useDM } from '../../hooks/useDM';
import { useAuthStore } from '../../store/authStore';

const dt = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const timeAgo = (value: string) => {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function OnlineDot({ className = '' }: { className?: string }) {
  return (
    <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400 ${className}`} />
  );
}

function OfflineDot({ className = '' }: { className?: string }) {
  return (
    <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-slate-900 bg-slate-500 ${className}`} />
  );
}

function ReadReceipt({ readAt, isMine }: { readAt?: string | null; isMine: boolean }) {
  if (!isMine) return null;
  return readAt ? (
    <span title={`Read ${dt(readAt)}`}>
      <CheckCheck className="inline h-3.5 w-3.5 text-purple-400" />
    </span>
  ) : (
    <span title="Sent">
      <Check className="inline h-3.5 w-3.5 text-slate-500" />
    </span>
  );
}

function MessageBubble({
  msg,
  isMine,
  partnerName,
  currentUserName,
}: {
  msg: DMMessage;
  isMine: boolean;
  partnerName: string;
  currentUserName: string;
}) {
  const isImage = msg.attachmentType === 'image';
  const isPdf = msg.attachmentType === 'pdf';

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <div className="mt-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
        {isMine ? initials(currentUserName) : initials(partnerName)}
      </div>
      <div className={`flex max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {msg.attachmentUrl ? (
          <div className="mb-1 overflow-hidden rounded-2xl">
            {isImage ? (
              <a href={msg.attachmentUrl} target="_blank" rel="noreferrer">
                <img
                  src={msg.attachmentUrl}
                  alt={msg.attachmentName || 'Image'}
                  className="max-w-[280px] max-h-[300px] object-cover transition-opacity hover:opacity-90"
                />
              </a>
            ) : isPdf ? (
              <a
                href={msg.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-700 bg-slate-800/80 p-3 transition-colors hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{msg.attachmentName || 'Document.pdf'}</p>
                    <p className="text-xs text-slate-400">PDF</p>
                  </div>
                </div>
              </a>
            ) : null}
            {msg.attachmentName && isImage ? (
              <p className={`px-2 py-1 text-xs text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                {msg.attachmentName}
              </p>
            ) : null}
          </div>
        ) : null}

        {msg.message ? (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isMine
                ? 'rounded-tr-sm bg-purple-600/20 text-white ring-1 ring-purple-500/20'
                : 'rounded-tl-sm bg-slate-800 text-slate-100'
            }`}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
          </div>
        ) : null}

        <div className={`mt-1 flex items-center gap-1.5 ${isMine ? 'justify-end' : ''}`}>
          <span className={`text-[11px] ${isMine ? 'text-purple-300/60' : 'text-slate-500'}`}>
            {dt(msg.sentAt)}
          </span>
          <ReadReceipt readAt={msg.readAt} isMine={isMine} />
        </div>
      </div>
    </div>
  );
}

/* ─── Conversation sidebar item ─── */
function ConversationItem({
  convo,
  isActive,
  currentUserId,
  onClick,
}: {
  convo: DMConversation;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const partner = convo.partner;
  const name = partner?.displayName ?? 'Unknown';
  const isMine = convo.lastMessage.senderId === currentUserId;
  const isOnline = convo.isOnline || partner?.isOnline;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
        isActive
          ? 'bg-purple-500/10 ring-1 ring-purple-500/30'
          : 'hover:bg-slate-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
          {partner?.avatar ? (
            <img
              src={partner.avatar}
              alt={name}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            initials(name)
          )}
        </div>
        {isOnline ? <OnlineDot /> : <OfflineDot />}
        {convo.unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm font-semibold ${isActive ? 'text-purple-200' : 'text-white'}`}
          >
            {name}
          </span>
          <span className="flex-shrink-0 text-[11px] text-slate-500">
            {timeAgo(convo.lastMessage.sentAt)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <p
            className={`truncate text-xs ${convo.unreadCount > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}
          >
            {isMine ? 'You: ' : ''}
            {getConversationPreviewText(convo.lastMessage)}
          </p>
          {isMine && (
            <span className="flex-shrink-0">
              <ReadReceipt readAt={convo.lastMessage.readAt} isMine={true} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Schedule Interview Modal ─── */
function ScheduleInterviewModal({
  partnerName,
  onSend,
  onClose,
}: {
  partnerName: string;
  onSend: (payload: {
    message: string;
    messageType: 'interview_request';
    scheduledAt: string;
    meetLink: string;
  }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (!date || !time) return;
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    onSend({
      message: note || `Interview scheduled with ${partnerName}`,
      messageType: 'interview_request',
      scheduledAt,
      meetLink: meetLink.trim(),
    });
    onClose();
  };

  // Compute tomorrow's date as minimum
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Schedule Interview
            </h3>
            <p className="text-xs text-slate-400">with {partnerName}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-purple-500"
            />
          </div>

          {/* Time */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-purple-500"
            />
          </div>

          {/* Meet link */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white">
              Meeting Link{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <div className="relative">
              <Video className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-purple-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white">
              Add a note{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Please be ready to discuss your latest project."
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-purple-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!date || !time}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-pink-500 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Panel ─── */
function ChatPanel({
  partnerId,
  partnerName,
  onOpenSchedule,
}: {
  partnerId: string;
  partnerName: string;
  onOpenSchedule: () => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const { messages, sendMessage, sendTyping, typingFromPartner, isLoading } =
    useDM(partnerId);
  const [draft, setDraft] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;

    requestAnimationFrame(() => {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage({ message: text, messageType: 'text' });
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread */}
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <MessageCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Start a conversation with {partnerName}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUser?._id;

              /* ── Interview Request Card ── */
              if (msg.messageType === 'interview_request') {
                return (
                  <div
                    key={msg._id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%] rounded-2xl border border-purple-500/30 bg-purple-900/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-300">
                        <Calendar className="h-4 w-4" />
                        Interview Request
                      </div>
                      {msg.message ? (
                        <p className="mb-2 text-sm text-slate-300">
                          {msg.message}
                        </p>
                      ) : null}
                      {msg.scheduledAt ? (
                        <p className="flex items-center gap-2 text-sm text-white">
                          <Clock className="h-4 w-4 text-purple-400" />
                          {new Date(msg.scheduledAt).toLocaleString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      ) : null}
                      {msg.meetLink ? (
                        <a
                          href={msg.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/30"
                        >
                          <Video className="h-3 w-3" />
                          Join Meeting{' '}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">{dt(msg.sentAt)}</span>
                        <ReadReceipt readAt={msg.readAt} isMine={isMine} />
                      </div>
                    </div>
                  </div>
                );
              }

              /* ── Regular text message ── */
              return (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  isMine={isMine}
                  partnerName={partnerName}
                  currentUserName={currentUser?.displayName ?? 'Me'}
                />
              );
            })}
            {/* Typing indicator */}
            {typingFromPartner ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="flex gap-1">
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  >
                    ●
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  >
                    ●
                  </span>
                  <span
                    className="animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  >
                    ●
                  </span>
                </div>
                {partnerName} is typing...
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex items-end gap-3">
          {/* Schedule interview button */}
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-purple-500/30 text-purple-400 transition hover:bg-purple-500/10 hover:text-purple-300"
            title="Schedule Interview"
          >
            <Calendar className="h-4 w-4" />
          </button>

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              sendTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${partnerName}...`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500 placeholder:text-slate-500"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-white transition hover:bg-purple-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-600">
          Enter to send · Shift+Enter for new line · 📅 Schedule interview
        </p>
      </div>

      {/* Schedule modal */}
      {showSchedule ? (
        <ScheduleInterviewModal
          partnerName={partnerName}
          onSend={(payload) => sendMessage(payload)}
          onClose={() => setShowSchedule(false)}
        />
      ) : null}
    </div>
  );
}

/* ─── Page ─── */
export function RecruiterMessagesPage() {
  const { partnerId } = useParams<{ partnerId?: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showHeaderSchedule, setShowHeaderSchedule] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<Array<{ _id: string; displayName: string; avatar?: string; role: string }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch partner profile for header when navigating to a new user
  const dmHook = useDM(partnerId ?? '');

  const conversationsQuery = useQuery({
    queryKey: ['dm', 'conversations'],
    queryFn: dmApi.listConversations,
    refetchInterval: 30_000,
  });

  const conversations = (conversationsQuery.data ?? []).filter((c) => {
    if (!search) return true;
    return (c.partner?.displayName ?? '')
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const activeConvo = conversations.find((c) => c.partnerId === partnerId);
  // Use partner profile from API if not in conversation list (new chat)
  const partnerName = activeConvo?.partner?.displayName
    ?? dmHook.partner?.displayName
    ?? (partnerId ? 'Loading...' : 'Unknown');
  const partnerRole = activeConvo?.partner?.role ?? dmHook.partner?.role ?? 'candidate';
  const partnerAvatar = activeConvo?.partner?.avatar ?? dmHook.partner?.avatar;
  const partnerOnline = activeConvo?.isOnline || dmHook.isPartnerOnline;

  const handleSelect = (pid: string) => {
    navigate(`/dashboard/recruiter/messages/${pid}`);
    queryClient.invalidateQueries({ queryKey: ['dm', 'thread', pid] });
    setSearch('');
    setUserSearchResults([]);
  };

  // Debounced user search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.trim().length < 2) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await dmApi.searchUsers(value.trim());
        setUserSearchResults(results);
      } catch {
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 400);
  }, []);

  // Filter out users who already have a conversation
  const existingPartnerIds = new Set((conversationsQuery.data ?? []).map((c) => c.partnerId));
  const newUsers = userSearchResults.filter((u) => !existingPartnerIds.has(u._id));

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100%+3rem)] min-h-0 overflow-hidden bg-slate-950 lg:-mx-8">
      {/* Sidebar — conversation list */}
      <div
        className={`flex min-h-0 flex-col border-r border-slate-800 bg-slate-900/50 ${
          partnerId
            ? 'hidden md:flex md:w-72 lg:w-80'
            : 'w-full md:w-72 lg:w-80'
        }`}
      >
        <div className="border-b border-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <MessageCircle className="h-5 w-5 text-purple-400" />
              Recruiter Messages
            </h2>
            <button
              type="button"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('#recruiter-msg-search');
                input?.focus();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="New message"
            >
              <PenSquare className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="recruiter-msg-search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search candidates or users"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-purple-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversationsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : conversations.length === 0 && !search ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <MessageCircle className="h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No conversations yet.</p>
              <p className="text-xs text-slate-600">
                Search for a user above, or search talent to connect with candidates.
              </p>
            </div>
          ) : (
            <>
              {conversations.map((convo) => (
                <ConversationItem
                  key={convo.partnerId}
                  convo={convo}
                  isActive={convo.partnerId === partnerId}
                  currentUserId={currentUser?._id ?? ''}
                  onClick={() => handleSelect(convo.partnerId)}
                />
              ))}

              {/* User search results — new conversations */}
              {search.trim().length >= 2 && (newUsers.length > 0 || isSearchingUsers) ? (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <div className="mb-2 flex items-center gap-2 px-3 text-xs uppercase tracking-widest text-slate-500">
                    <Users className="h-3 w-3" />
                    All users
                  </div>
                  {isSearchingUsers ? (
                    <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>
                  ) : (
                    newUsers.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        onClick={() => handleSelect(user._id)}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:bg-slate-800/60"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.displayName} className="h-11 w-11 rounded-full object-cover" />
                          ) : (
                            initials(user.displayName)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white">{user.displayName}</div>
                          <div className="text-xs capitalize text-slate-500">{user.role}</div>
                        </div>
                        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                          New
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}

              {search.trim().length >= 2 && conversations.length === 0 && newUsers.length === 0 && !isSearchingUsers ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500">No users found matching &ldquo;{search}&rdquo;</div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {partnerId ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/recruiter/messages')}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                  {partnerAvatar ? (
                    <img
                      src={partnerAvatar}
                      alt={partnerName}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    initials(partnerName)
                  )}
                </div>
                {partnerOnline ? (
                  <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-slate-950 bg-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {partnerName}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={partnerOnline ? 'text-emerald-400' : 'text-slate-500'}>
                    {partnerOnline ? 'Online' : 'Offline'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="capitalize text-slate-500">{partnerRole}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHeaderSchedule(true)}
                className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/10"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </button>
            </div>
            <ChatPanel
              partnerId={partnerId}
              partnerName={partnerName}
              onOpenSchedule={() => setShowHeaderSchedule(true)}
            />

            {/* Header-triggered schedule modal */}
            {showHeaderSchedule ? (
              <ScheduleInterviewModal
                partnerName={partnerName}
                onSend={(payload) => dmHook.sendMessage(payload)}
                onClose={() => setShowHeaderSchedule(false)}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 ring-1 ring-purple-500/20">
              <MessageCircle className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">
              Recruiter Messages
            </h3>
            <p className="max-w-sm text-sm text-slate-400">
              Connect with candidates, schedule interviews, and manage hiring
              conversations — all in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-400" />
                Interview scheduling
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5 text-purple-400" />
                Meeting links
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Send className="h-3.5 w-3.5 text-purple-400" />
                Real-time chat
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
