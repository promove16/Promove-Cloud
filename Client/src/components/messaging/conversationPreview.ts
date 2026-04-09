import type { DMMessage } from '../../api/dm.api';

const startupHandshakeMarker = '[PROMOVE_STARTUP_HANDSHAKE]';

const normalizePreviewText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getStartupHandshakePreview = (message: string) => {
  if (!message.startsWith(startupHandshakeMarker)) {
    return null;
  }

  const fields = message
    .split(/\r?\n/)
    .slice(1)
    .reduce<Record<string, string>>((accumulator, line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        accumulator[match[1].trim().toLowerCase()] = match[2].trim();
      }
      return accumulator;
    }, {});

  const action = fields.action?.trim().toLowerCase();
  const startupName = fields.startup?.trim();

  if (action === 'investor') {
    return startupName ? `Pitch request: ${startupName}` : 'Startup pitch request';
  }

  if (action === 'mentor') {
    return startupName ? `Mentorship request: ${startupName}` : 'Startup mentorship request';
  }

  if (action === 'student') {
    return startupName ? `Startup invite: ${startupName}` : 'Startup invite';
  }

  return 'Startup request';
};

export const getConversationPreviewText = (
  lastMessage: Pick<DMMessage, 'message' | 'messageType'>,
) => {
  if (lastMessage.messageType === 'interview_request') {
    return 'Interview request';
  }

  const message = normalizePreviewText(lastMessage.message ?? '');
  if (!message) {
    return '...';
  }

  return getStartupHandshakePreview(message) ?? message;
};
