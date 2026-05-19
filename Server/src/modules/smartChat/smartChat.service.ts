import { env } from '../../config/env';
import { logError } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '../../types/roles.types';

export interface SmartChatContext {
  pathname?: string;
  routeLabel?: string;
}

export interface SmartChatUser {
  role?: UserRole | null;
  email?: string | null;
}

export interface GenerateReplyInput {
  message: string;
  context?: SmartChatContext;
  user?: SmartChatUser;
}

const buildSystemPrompt = ({ context, user }: GenerateReplyInput) => {
  const role = user?.role ? user.role : 'guest';
  const pathname = context?.pathname || 'unknown';
  const routeLabel = context?.routeLabel || 'Workspace';

  return [
    'You are Smart Chat, a concise floating assistant inside the ProMove workspace platform.',
    'ProMove connects students, mentors, investors, recruiters, schools, colleges, and institutions around startups, deals, marketplace listings, and projects.',
    `The current user role is "${role}". They are on route "${pathname}" (page label: "${routeLabel}").`,
    'Keep replies short (2–4 sentences). Prefer plain text, no markdown headings. Tailor answers to the user role and current page when relevant.',
    'If asked to perform actions you cannot do (creating data, sending messages), explain what page or action they should take next instead.',
  ].join(' ');
};

interface GroqChoice {
  message?: { content?: string };
}

interface GroqResponse {
  choices?: GroqChoice[];
  error?: { message?: string };
}

export const generateSmartChatReply = async (input: GenerateReplyInput): Promise<string> => {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(
      503,
      'SMART_CHAT_DISABLED',
      'Smart Chat AI is not configured. Set GROQ_API_KEY on the server.',
    );
  }

  const trimmed = input.message.trim();
  if (!trimmed) {
    throw new ApiError(400, 'SMART_CHAT_EMPTY_MESSAGE', 'Message is required');
  }
  if (trimmed.length > 2000) {
    throw new ApiError(
      400,
      'SMART_CHAT_MESSAGE_TOO_LONG',
      'Message must be 2000 characters or fewer',
    );
  }

  const body = {
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(input) },
      { role: 'user', content: trimmed },
    ],
    temperature: 0.5,
    max_tokens: 400,
  };

  let response: Response;
  try {
    response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logError('Smart Chat upstream fetch failed', err);
    throw new ApiError(
      502,
      'SMART_CHAT_UPSTREAM_UNREACHABLE',
      'Smart Chat provider is not reachable right now',
      [{ cause: err instanceof Error ? err.message : String(err) }],
    );
  }

  const rawBody = await response.text();
  let data: GroqResponse = {};
  try {
    data = rawBody ? (JSON.parse(rawBody) as GroqResponse) : {};
  } catch {
    // Non-JSON response (HTML error page, etc.) — leave data empty so we surface raw body below.
  }

  if (!response.ok) {
    logError(
      `Smart Chat upstream returned ${response.status} for model "${env.GROQ_MODEL}"`,
      data.error?.message || rawBody.slice(0, 500),
    );
    throw new ApiError(
      502,
      'SMART_CHAT_UPSTREAM_ERROR',
      data.error?.message || `Smart Chat provider returned ${response.status}`,
    );
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new ApiError(502, 'SMART_CHAT_EMPTY_REPLY', 'Smart Chat provider returned no reply');
  }
  return reply;
};
