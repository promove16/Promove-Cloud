import { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { dmApi, DMConversation } from '../../api/dm.api';
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
        <p
          className={`truncate text-xs ${convo.unreadCount > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}
        >
          {isMine ? 'You: ' : ''}
          {convo.lastMessage.messageType === 'interview_request'
            ? '📅 Interview request'
            : convo.lastMessage.message || '…'}
        </p>
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
}: {
  partnerId: string;
  partnerName: string;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const { messages, sendMessage, sendTyping, typingFromPartner, isLoading } =
    useDM(partnerId);
  const [draft, setDraft] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex h-full flex-col">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
                      <p className="mt-2 text-[11px] text-slate-500">
                        {dt(msg.sentAt)}
                      </p>
                    </div>
                  </div>
                );
              }

              /* ── Regular text message ── */
              return (
                <div
                  key={msg._id}
                  className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <div className="mt-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                    {isMine
                      ? initials(currentUser?.displayName ?? 'Me')
                      : initials(partnerName)}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'rounded-tr-sm bg-purple-600/20 text-white ring-1 ring-purple-500/20'
                        : 'rounded-tl-sm bg-slate-800 text-slate-100'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p
                      className={`mt-1 text-[11px] ${isMine ? 'text-right text-purple-300/60' : 'text-slate-500'}`}
                    >
                      {dt(msg.sentAt)}
                    </p>
                  </div>
                </div>
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
            <div ref={bottomRef} />
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
            placeholder={`Message ${partnerName}…`}
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
  const partnerName = activeConvo?.partner?.displayName ?? 'Unknown';

  const handleSelect = (pid: string) => {
    navigate(`/dashboard/recruiter/messages/${pid}`);
    queryClient.invalidateQueries({ queryKey: ['dm', 'thread', pid] });
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      {/* Sidebar — conversation list */}
      <div
        className={`flex flex-col border-r border-slate-800 bg-slate-900/50 ${
          partnerId
            ? 'hidden md:flex md:w-72 lg:w-80'
            : 'w-full md:w-72 lg:w-80'
        }`}
      >
        <div className="border-b border-slate-800 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <MessageCircle className="h-5 w-5 text-purple-400" />
            Recruiter Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-purple-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversationsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <MessageCircle className="h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No conversations yet.</p>
              <p className="text-xs text-slate-600">
                Search talent or start a campus drive to connect with candidates.
              </p>
            </div>
          ) : (
            conversations.map((convo) => (
              <ConversationItem
                key={convo.partnerId}
                convo={convo}
                isActive={convo.partnerId === partnerId}
                currentUserId={currentUser?._id ?? ''}
                onClick={() => handleSelect(convo.partnerId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                {activeConvo?.partner?.avatar ? (
                  <img
                    src={activeConvo.partner.avatar}
                    alt={partnerName}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  initials(partnerName)
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {partnerName}
                </div>
                <div className="text-xs capitalize text-slate-500">
                  {activeConvo?.partner?.role ?? 'candidate'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  /* Would open schedule modal from header too */
                }}
                className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/10"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </button>
            </div>
            <ChatPanel partnerId={partnerId} partnerName={partnerName} />
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
