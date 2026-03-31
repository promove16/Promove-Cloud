import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Search, Send, ArrowLeft, Calendar, ExternalLink } from 'lucide-react';
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
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

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
        isActive ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'hover:bg-slate-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
          {partner?.avatar ? (
            <img src={partner.avatar} alt={name} className="h-11 w-11 rounded-full object-cover" />
          ) : (
            initials(name)
          )}
        </div>
        {convo.unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm font-semibold ${isActive ? 'text-cyan-200' : 'text-white'}`}>{name}</span>
          <span className="flex-shrink-0 text-[11px] text-slate-500">{timeAgo(convo.lastMessage.sentAt)}</span>
        </div>
        <p className={`truncate text-xs ${convo.unreadCount > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
          {isMine ? 'You: ' : ''}
          {convo.lastMessage.messageType === 'interview_request'
            ? '📅 Interview request'
            : convo.lastMessage.message || '…'}
        </p>
      </div>
    </button>
  );
}

function ChatPanel({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { messages, sendMessage, sendTyping, typingFromPartner, isLoading } = useDM(partnerId);
  const [draft, setDraft] = useState('');
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
          <div className="flex h-full items-center justify-center text-slate-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <MessageCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Start a conversation with {partnerName}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUser?._id;
              if (msg.messageType === 'interview_request') {
                return (
                  <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] rounded-2xl border border-purple-500/30 bg-purple-900/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-300">
                        <Calendar className="h-4 w-4" />
                        Interview Request
                      </div>
                      {msg.message ? <p className="mb-2 text-sm text-slate-300">{msg.message}</p> : null}
                      {msg.scheduledAt ? (
                        <p className="text-sm text-white">
                          📅 {new Date(msg.scheduledAt).toLocaleString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
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
                          Join Meeting <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-500">{dt(msg.sentAt)}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                  <div className="mt-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
                    {isMine
                      ? initials(currentUser?.displayName ?? 'Me')
                      : initials(partnerName)}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'rounded-tr-sm bg-cyan-600/20 text-white ring-1 ring-cyan-500/20'
                        : 'rounded-tl-sm bg-slate-800 text-slate-100'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p className={`mt-1 text-[11px] ${isMine ? 'text-right text-cyan-300/60' : 'text-slate-500'}`}>
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
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
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
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); sendTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${partnerName}…`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-500"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-600">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

export function MessagesPage() {
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
    return (c.partner?.displayName ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const activeConvo = conversations.find((c) => c.partnerId === partnerId);
  const partnerName = activeConvo?.partner?.displayName ?? 'Unknown';

  const handleSelect = (pid: string) => {
    navigate(`/dashboard/messages/${pid}`);
    queryClient.invalidateQueries({ queryKey: ['dm', 'thread', pid] });
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      {/* Sidebar — conversation list */}
      <div
        className={`flex flex-col border-r border-slate-800 bg-slate-900/50 ${
          partnerId ? 'hidden md:flex md:w-72 lg:w-80' : 'w-full md:w-72 lg:w-80'
        }`}
      >
        <div className="border-b border-slate-800 p-4">
          <h2 className="mb-3 text-lg font-bold text-white">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversationsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <MessageCircle className="h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No conversations yet.</p>
              <p className="text-xs text-slate-600">
                Find mentors, investors, or recruiters in the Marketplace to start chatting.
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
                onClick={() => navigate('/dashboard/messages')}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
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
              <div>
                <div className="text-sm font-semibold text-white">{partnerName}</div>
                <div className="text-xs capitalize text-slate-500">{activeConvo?.partner?.role ?? 'user'}</div>
              </div>
            </div>
            <ChatPanel partnerId={partnerId} partnerName={partnerName} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <MessageCircle className="h-14 w-14 text-slate-700" />
            <h3 className="text-xl font-semibold text-white">Your Messages</h3>
            <p className="max-w-sm text-sm text-slate-400">
              Select a conversation or connect with someone from the Marketplace to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
