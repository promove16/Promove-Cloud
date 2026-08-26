import { useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizontal, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { smartChatApi } from '../../api/smartChat.api';

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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
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
  }, [isOpen, messages.length, isSending]);

  const submitPrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();

    if (!prompt || isSending) {
      return;
    }

    const meta = `${routeLabel} | ${getRoleLabel(user?.role)}`;
    const userMessage = createMessage('user', prompt);
    setMessages((current) => [...current, userMessage]);
    setInput('');

    if (!isAuthenticated) {
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          'Sign in to chat with Smart Chat. While signed out I can only show static page hints.',
          meta,
        ),
      ]);
      return;
    }

    setIsSending(true);
    try {
      const { reply } = await smartChatApi.sendMessage({
        message: prompt,
        context: { pathname: location.pathname, routeLabel },
      });
      setMessages((current) => [
        ...current,
        createMessage('assistant', reply, meta),
      ]);
    } catch (error) {
      const fallback = getPromptReply({
        prompt,
        pathname: location.pathname,
        role: user?.role,
      });
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          `${fallback}\n\n(Smart Chat AI is unavailable right now — showing a static hint instead.)`,
          meta,
        ),
      ]);
      if (import.meta.env.DEV) {
        console.error('Smart Chat request failed', error);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (shouldHideSmartChat) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none fixed bottom-5 right-4 ${
        isOpen ? 'z-50' : 'z-40'
      } flex items-end justify-end`}
    >
      {isOpen ? (
        <div className="pointer-events-auto flex w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Smart Chat
              </span>
              <span className="truncate text-xs text-slate-400 dark:text-slate-500">
                · {routeLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-200"
              aria-label="Close Smart Chat"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={viewportRef} className="h-[420px] overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {messages.length <= 1 ? (
                <div className="flex flex-wrap gap-2 pb-1">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        void submitPrompt(prompt);
                      }}
                      disabled={isSending}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/5"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {messages.map((message) => {
                const isUser = message.role === 'user';

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-100 px-3.5 py-2 text-sm leading-6 text-slate-800 dark:bg-white/10 dark:text-slate-100">
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.meta ? (
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {message.meta}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {isSending ? (
                <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitPrompt(input);
            }}
            className="border-t border-slate-100 px-3 py-3 dark:border-white/5"
          >
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 transition focus-within:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:focus-within:border-white/20">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message Smart Chat"
                disabled={isSending}
                className="h-8 flex-1 border-0 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={input.trim() === '' || isSending}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-slate-200"
                aria-label="Send Smart Chat message"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
          aria-label="Open Smart Chat"
          title="Smart Chat"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
