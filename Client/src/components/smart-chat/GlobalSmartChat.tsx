import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, SendHorizontal, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

type SmartChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
};

const createMessage = (
  role: SmartChatMessage['role'],
  content: string,
  meta?: string,
): SmartChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  ...(meta ? { meta } : {}),
});

const formatRouteLabel = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'Homepage';
  }

  return segments[segments.length - 1]
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const getRoleLabel = (role?: UserRole | null) => {
  if (!role) {
    return 'Guest';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const getRouteSummary = (pathname: string) => {
  if (pathname.includes('/college/events')) {
    return 'You are viewing the college events workspace.';
  }

  if (pathname.includes('/messages')) {
    return 'You are in the messaging workspace.';
  }

  if (pathname.includes('/marketplace')) {
    return 'You are browsing the marketplace.';
  }

  if (pathname.includes('/dashboard')) {
    return 'You are inside the dashboard.';
  }

  return 'You are exploring the platform.';
};

const getPromptReply = ({
  prompt,
  pathname,
  role,
}: {
  prompt: string;
  pathname: string;
  role?: UserRole | null;
}) => {
  const normalizedPrompt = prompt.toLowerCase();
  const routeSummary = getRouteSummary(pathname);
  const roleLabel = getRoleLabel(role);

  if (normalizedPrompt.includes('help') || normalizedPrompt.includes('what can')) {
    return `${routeSummary} Smart Chat is currently a floating assistant UI available from every page.`;
  }

  if (normalizedPrompt.includes('events')) {
    return `${routeSummary} For ${roleLabel.toLowerCase()} users, this is a good place to surface event reminders, summaries, and quick actions next.`;
  }

  if (normalizedPrompt.includes('page') || normalizedPrompt.includes('where')) {
    return `${routeSummary} The current page label is ${formatRouteLabel(pathname)}.`;
  }

  return `${routeSummary} Smart Chat is active for the ${roleLabel.toLowerCase()} experience and can be extended with role-specific actions next.`;
};

export function GlobalSmartChat() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SmartChatMessage[]>([
    createMessage(
      'assistant',
      'Smart Chat is available from every page as a floating workspace companion.',
    ),
  ]);

  const routeLabel = useMemo(
    () => formatRouteLabel(location.pathname),
    [location.pathname],
  );
  const shouldHideSmartChat = location.pathname.includes('/messages');

  const quickPrompts = useMemo(
    () => [
      'What can Smart Chat help with here?',
      'Summarize this page context.',
      'What should happen next in this workspace?',
    ],
    [],
  );

  useEffect(() => {
    if (!viewportRef.current || !isOpen) {
      return;
    }

    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [isOpen, messages.length]);

  const submitPrompt = (rawPrompt: string) => {
    const prompt = rawPrompt.trim();

    if (!prompt) {
      return;
    }

    const userMessage = createMessage('user', prompt);
    const assistantReply = createMessage(
      'assistant',
      getPromptReply({
        prompt,
        pathname: location.pathname,
        role: user?.role,
      }),
      `${routeLabel} | ${getRoleLabel(user?.role)}`,
    );

    setMessages((current) => [...current, userMessage, assistantReply]);
    setInput('');
  };

  if (shouldHideSmartChat) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-50 flex items-end justify-end">
      {isOpen ? (
        <div className="pointer-events-auto w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-[28px] border border-white/12 bg-[#767b91]/95 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-4 text-white">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                Smart Chat
              </div>
              <div className="mt-1 text-xs text-white/65">{routeLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close Smart Chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={viewportRef} className="h-[420px] overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/12 bg-black/20 p-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                  Context
                </div>
                <div className="mt-3 text-sm leading-6 text-white/85">
                  {getRouteSummary(location.pathname)}
                </div>
              </div>

              {messages.length <= 1 ? (
                <div className="space-y-3">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => submitPrompt(prompt)}
                      className="w-full rounded-[20px] border border-white/12 bg-black/20 px-4 py-3 text-left text-sm text-white transition hover:bg-black/28"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {messages.map((message) => {
                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-[22px] px-4 py-3 ${
                        isUser ? 'bg-white text-slate-900' : 'bg-black/28 text-white'
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          isUser ? 'text-slate-500' : 'text-white/55'
                        }`}
                      >
                        {isUser ? 'You' : 'Smart Chat'}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </div>
                      {message.meta ? (
                        <div
                          className={`mt-3 text-[11px] ${
                            isUser ? 'text-slate-500' : 'text-white/45'
                          }`}
                        >
                          {message.meta}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/10 p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitPrompt(input);
              }}
            >
              <div className="flex items-center gap-3 rounded-full border border-black/45 bg-white px-4 py-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Type your message..."
                  className="h-10 flex-1 border-0 bg-transparent text-base text-slate-800 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={input.trim() === ''}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send Smart Chat message"
                >
                  <SendHorizontal className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-950/90 text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-slate-900"
          aria-label="Open Smart Chat"
          title="Smart Chat"
        >
          <MessageCircle className="h-5 w-5 text-cyan-300" />
        </button>
      )}
    </div>
  );
}
