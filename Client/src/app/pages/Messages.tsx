import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  MessageCircle, Search, Send, ArrowLeft, Calendar, ExternalLink, PenSquare, Users,
  Check, CheckCheck, MoreVertical, AlertTriangle, GraduationCap, TrendingUp, Building2,
  Image, FileText, X, Paperclip, UserPlus, Inbox
} from 'lucide-react';
import { dmApi, DMConversation, DMMessage, QueryType } from '../../api/dm.api';
import { startupApi } from '../../api/startup.api';
import { useDM } from '../../hooks/useDM';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { QueryTypeModal } from '../../components/messaging/QueryTypeModal';
import { ReportUserModal } from '../../components/messaging/ReportUserModal';
import { InvestorProposalReplyActions } from '../../components/messaging/InvestorProposalModal';
import { InvitationCard } from '../../components/messaging/InvitationCard';
import { getConversationPreviewText } from '../../components/messaging/conversationPreview';
import { getVisibleAssociationQueryTypes, isAssociationQueryType, normalizeMessagingRole } from '../../components/messaging/queryTypeVisibility';
import {
  StartupHandshakeDmPayload,
  StartupInviteModal,
  StartupInviteTarget,
  StartupInviteTargetType,
  buildStartupHandshakeDmMessage,
} from '../../features/marketplace/StartupInviteModal';
import { getMarketplaceBasePath } from '../../features/marketplace/navigation';
import { InvitationPage } from '../../features/invitations/InvitationPage';
import {
  getRequestTypeLabel,
  formatRequestStatus,
  getRequestActorLabel,
  getRequestEntityName,
} from '../../features/invitations/requestPresentation';
import { requestApi } from '../../api/request.api';
import { WorkflowRequest } from '../../types/request.types';

type PendingAttachmentState = {
  previewUrl: string;
  uploadedUrl?: string;
  localObjectUrl: string;
  fileType: 'image' | 'pdf';
  fileName: string;
  fileSize: number;
  isUploading: boolean;
};

type DMHookState = ReturnType<typeof useDM>;

const attachmentMaxSizeBytes = 10 * 1024 * 1024;
const allowedAttachmentMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
const allowedAttachmentExtensionPattern = /\.(jpe?g|png|gif|webp|pdf)$/i;

const getAttachmentUploadErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Attachment upload failed. Please try again.';
  }
  return error instanceof Error ? error.message : 'Attachment upload failed. Please try again.';
};

const dt = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatMessageDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatAttachmentSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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

const isValidQueryType = (value: string | null): value is QueryType =>
  value === 'project_mentor' ||
  value === 'project_join' ||
  value === 'investor' ||
  value === 'recruiter' ||
  value === 'hiring_event' ||
  value === 'mentorship_program' ||
  value === 'general';

const getAutoQueryTypeForRole = (role?: string | null, senderRole?: string | null): QueryType | null => {
  const visibleTypes = getVisibleAssociationQueryTypes(role, senderRole);
  return visibleTypes[0] ?? null;
};

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
      <CheckCheck className="inline h-3.5 w-3.5 text-cyan-400" />
    </span>
  ) : (
    <span title="Sent">
      <Check className="inline h-3.5 w-3.5 text-slate-500" />
    </span>
  );
}

type InvestorPitchDetails = {
  intro: string;
  startupName?: string;
  tagline?: string;
  category?: string;
  stage?: string;
  fundingNeeded?: string;
  teamSize?: string;
  tractionItems: string[];
  pitchDeckUrl?: string;
  closing: string;
};

const investorPitchFieldLabels = new Set([
  'Startup',
  'Category',
  'Stage',
  'Funding Needed',
  'Team Size',
  'Traction',
  'Pitch Deck',
]);

const stripLeadingDecorators = (value: string) =>
  value.replace(/^[^A-Za-z0-9]+/, '').trim();

const extractFirstEmphasizedText = (value: string) => {
  const match = value.match(/\*\*([^*]+)\*\*/);
  return match?.[1]?.trim();
};

const parseInvestorPitch = (message: string): InvestorPitchDetails | null => {
  if (!message.trim()) return null;

  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const hasInvestorFormatting =
    /\*\*[^*]+\*\*/.test(message) ||
    lines.some((line) => {
      const cleaned = stripLeadingDecorators(line);
      const label = cleaned.split(':')[0]?.trim();
      return investorPitchFieldLabels.has(label);
    });

  if (!hasInvestorFormatting) return null;

  const details: InvestorPitchDetails = {
    intro: '',
    tractionItems: [],
    closing: '',
  };

  const introLines: string[] = [];
  const closingLines: string[] = [];
  let hasStructuredFields = false;

  for (const rawLine of lines) {
    const cleanedLine = stripLeadingDecorators(rawLine);
    const match = cleanedLine.match(
      /^(Startup|Category|Stage|Funding Needed|Team Size|Traction|Pitch Deck):\s*(.+)$/i,
    );

    if (match) {
      hasStructuredFields = true;
      const [, rawLabel, rawValue] = match;
      const label = rawLabel.trim();
      const value = rawValue.trim();

      if (label === 'Startup') details.startupName = value;
      if (label === 'Category') details.category = value;
      if (label === 'Stage') details.stage = value;
      if (label === 'Funding Needed') details.fundingNeeded = value;
      if (label === 'Team Size') details.teamSize = value;
      if (label === 'Traction') {
        details.tractionItems = value
          .split(/\s*(?:,|\u00b7|\u2022|\|)\s*/u)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (label === 'Pitch Deck') details.pitchDeckUrl = value;
      continue;
    }

    if (hasStructuredFields && details.startupName && !details.tagline) {
      details.tagline = cleanedLine;
      continue;
    }

    if (hasStructuredFields) {
      closingLines.push(cleanedLine);
    } else {
      introLines.push(rawLine);
    }
  }

  details.intro = introLines.join(' ').trim();
  details.closing = closingLines.join(' ').trim();

  if (!details.startupName) {
    details.startupName = extractFirstEmphasizedText(details.intro);
  }

  return details;
};

function EmphasizedMessageText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/);
        if (!match) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <strong key={`${match[1]}-${index}`} className="font-semibold text-white">
            {match[1]}
          </strong>
        );
      })}
    </p>
  );
}

function InvestorPitchCard({
  details,
  isMine,
}: {
  details: InvestorPitchDetails;
  isMine: boolean;
}) {
  const accentBorder = isMine ? 'border-emerald-400/30' : 'border-cyan-400/20';
  const accentBackground = isMine
    ? 'bg-gradient-to-br from-emerald-500/12 via-slate-900 to-slate-900'
    : 'bg-gradient-to-br from-cyan-500/10 via-slate-800 to-slate-900';

  return (
    <div className={`w-full overflow-hidden rounded-[1.35rem] border ${accentBorder} ${accentBackground}`}>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              <TrendingUp className="h-3.5 w-3.5" />
              Investment Pitch
            </div>
            {details.startupName ? (
              <h4 className="mt-2 text-base font-semibold text-white">{details.startupName}</h4>
            ) : null}
            {details.tagline ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{details.tagline}</p>
            ) : null}
          </div>
          {details.stage ? (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {details.stage}
            </span>
          ) : null}
        </div>

        {details.intro ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <EmphasizedMessageText
              text={details.intro}
              className="text-sm leading-relaxed text-slate-100"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {details.category || details.fundingNeeded || details.teamSize ? (
          <div className="flex flex-wrap gap-2">
            {details.category ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                {details.category}
              </span>
            ) : null}
            {details.fundingNeeded ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                Seeking {details.fundingNeeded}
              </span>
            ) : null}
            {details.teamSize ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                Team size {details.teamSize}
              </span>
            ) : null}
          </div>
        ) : null}

        {details.tractionItems.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Traction
            </p>
            <div className="flex flex-wrap gap-2">
              {details.tractionItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {details.pitchDeckUrl ? (
          <a
            href={details.pitchDeckUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15"
          >
            <ExternalLink className="h-4 w-4" />
            Open pitch deck
          </a>
        ) : null}

        {details.closing ? (
          <p className="text-sm leading-relaxed text-slate-200">{details.closing}</p>
        ) : null}
      </div>
    </div>
  );
}

type StartupHandshakeDetails = {
  action: StartupInviteTargetType;
  requestType?: string;
  actionType?: string;
  requestId?: string;
  startupId?: string;
  startupName: string;
  tagline?: string;
  category?: string;
  stage?: string;
  fundingNeeded?: string;
  requestedRole?: string;
  recipientName?: string;
  status?: string;
  note?: string;
};

const startupHandshakeMarker = '[PROMOVE_STARTUP_HANDSHAKE]';

const getStartupHandshakeActionLabel = (targetType: StartupInviteTargetType) => {
  if (targetType === 'investor') return 'Pitch';
  if (targetType === 'mentor') return 'Mentorship';
  return 'Invite';
};

const isStartupHandshakeTargetType = (value: string): value is StartupInviteTargetType =>
  value === 'student' || value === 'mentor' || value === 'investor';

const getStartupHandshakeCardConfig = (targetType: StartupInviteTargetType) => {
  if (targetType === 'investor') {
    return {
      title: 'Startup Pitch',
      icon: <TrendingUp className="h-4 w-4" />,
      borderClassName: 'border-emerald-400/25',
      backgroundClassName: 'bg-gradient-to-br from-emerald-500/12 via-slate-900 to-slate-950',
      iconClassName: 'bg-emerald-500/15 text-emerald-200',
      badgeClassName: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
      eyebrowClassName: 'text-emerald-300/80',
    };
  }

  if (targetType === 'mentor') {
    return {
      title: 'Startup Mentorship',
      icon: <GraduationCap className="h-4 w-4" />,
      borderClassName: 'border-cyan-400/25',
      backgroundClassName: 'bg-gradient-to-br from-cyan-500/12 via-slate-900 to-slate-950',
      iconClassName: 'bg-cyan-500/15 text-cyan-200',
      badgeClassName: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
      eyebrowClassName: 'text-cyan-300/80',
    };
  }

  return {
    title: 'Startup Invite',
    icon: <UserPlus className="h-4 w-4" />,
    borderClassName: 'border-fuchsia-400/25',
    backgroundClassName: 'bg-gradient-to-br from-fuchsia-500/12 via-slate-900 to-slate-950',
    iconClassName: 'bg-fuchsia-500/15 text-fuchsia-200',
    badgeClassName: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100',
    eyebrowClassName: 'text-fuchsia-200/80',
  };
};

const parseStartupHandshake = (message: string): StartupHandshakeDetails | null => {
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

  const rawAction = fields.action?.trim().toLowerCase();
  if (!rawAction || !isStartupHandshakeTargetType(rawAction)) {
    return null;
  }

  const startupName = fields.startup?.trim();
  if (!startupName) {
    return null;
  }

  return {
    action: rawAction,
    requestType: fields['request type'],
    actionType: fields['action type'],
    requestId: fields['request id'],
    startupId: fields['startup id'],
    startupName,
    tagline: fields.tagline,
    category: fields.category,
    stage: fields.stage,
    fundingNeeded: fields['funding needed'],
    requestedRole: fields['requested role'],
    recipientName: fields.recipient,
    status: fields.status,
    note: fields.note,
  };
};

function StartupHandshakeCard({
  details,
  isMine,
}: {
  details: StartupHandshakeDetails;
  isMine: boolean;
}) {
  const config = getStartupHandshakeCardConfig(details.action);
  const statusLabel = details.status ? details.status.replace(/_/g, ' ') : 'pending';

  return (
    <div className={`w-full overflow-hidden rounded-[1.35rem] border ${config.borderClassName} ${config.backgroundClassName}`}>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${config.eyebrowClassName}`}>
              {config.icon}
              {config.title}
            </div>
            <h4 className="mt-2 text-base font-semibold text-white">{details.startupName}</h4>
            {details.tagline ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{details.tagline}</p>
            ) : null}
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${config.badgeClassName}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {details.category || details.stage || details.fundingNeeded ? (
          <div className="flex flex-wrap gap-2">
            {details.category ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                {details.category}
              </span>
            ) : null}
            {details.stage ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                {details.stage}
              </span>
            ) : null}
            {details.fundingNeeded ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">
                {details.fundingNeeded}
              </span>
            ) : null}
          </div>
        ) : null}

        {details.requestedRole ? (
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Requested Role
            </p>
            <p className="mt-1 text-sm text-slate-100">{details.requestedRole}</p>
          </div>
        ) : null}

        {details.note ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Note
            </p>
            <p className="text-sm leading-relaxed text-slate-200">{details.note}</p>
          </div>
        ) : null}

        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          {isMine
            ? `${getStartupHandshakeActionLabel(details.action)} request sent`
            : `${getStartupHandshakeActionLabel(details.action)} request received`}
        </p>
      </div>
    </div>
  );
}

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
        isActive ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'hover:bg-slate-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
          {partner?.avatar ? (
            <img src={partner.avatar} alt={name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            initials(name)
          )}
        </div>
        {isOnline ? <OnlineDot /> : <OfflineDot />}
        {convo.unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm font-semibold ${isActive ? 'text-cyan-200' : 'text-white'}`}>{name}</span>
          <span className="flex-shrink-0 text-[11px] text-slate-500">{timeAgo(convo.lastMessage.sentAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <p className={`truncate text-xs ${convo.unreadCount > 0 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
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

interface FirstContactPanelProps {
  partnerName: string;
  partnerRole?: string;
  currentUserRole?: string;
  onSend: (message: string, queryType: QueryType) => void;
  initialQueryType?: QueryType | null;
}

function FirstContactPanel({ partnerName, partnerRole, currentUserRole, onSend, initialQueryType }: FirstContactPanelProps) {
  const [selectedType, setSelectedType] = useState<QueryType | null>(initialQueryType ?? null);
  const [customMessage, setCustomMessage] = useState('');
  const visibleAssociationTypes = new Set(getVisibleAssociationQueryTypes(partnerRole, currentUserRole));

  const queryTypes: { type: QueryType; label: string; icon: React.ReactNode; color: string; autoMessages: string[] }[] = [
    {
      type: 'project_mentor',
      label: 'Project Mentor',
      icon: <GraduationCap className="h-5 w-5" />,
      color: 'from-blue-500 to-cyan-500',
      autoMessages: [
        'Hi! I am working on a project and would love to get your guidance and mentorship.',
        'I am looking for a mentor who can help me with my startup project.',
      ],
    },
    {
      type: 'project_join',
      label: 'Project Join',
      icon: <Users className="h-5 w-5" />,
      color: 'from-fuchsia-500 to-indigo-500',
      autoMessages: [
        'Hi! I came across your project on ProMove and would love to join your team if you are open to collaborators.',
        'Hello! Your project looks exciting. I would like to contribute and explore joining the team.',
      ],
    },
    {
      type: 'investor',
      label: 'Investor',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'from-emerald-500 to-teal-500',
      autoMessages: [
        'Hi! I have an exciting startup that I believe has great potential.',
        'I am currently raising funds for my startup and would love to discuss.',
      ],
    },
    {
      type: 'recruiter',
      label: 'Recruiter',
      icon: <Building2 className="h-5 w-5" />,
      color: 'from-purple-500 to-pink-500',
      autoMessages: [
        'Hi! I am interested in career opportunities at your organization.',
        'I would love to discuss potential opportunities with your team.',
      ],
    },
    {
      type: 'hiring_event',
      label: 'Hiring Event',
      icon: <Calendar className="h-5 w-5" />,
      color: 'from-amber-500 to-orange-500',
      autoMessages: [
        'Hi! I would like to organize a hiring event with your college and explore student talent for open roles.',
        'Hello! I am planning a campus hiring event and would like to coordinate with your college placement team.',
      ],
    },
    {
      type: 'mentorship_program',
      label: 'Mentorship Program',
      icon: <GraduationCap className="h-5 w-5" />,
      color: 'from-cyan-500 to-blue-500',
      autoMessages: [
        'Hi! I would like to support your students through a mentorship program. Could we discuss the format and schedule?',
        'Hello! I am available for a mentorship program with your institution and would like to understand your preferred topics.',
      ],
    },
    {
      type: 'general',
      label: 'General Query',
      icon: <MessageCircle className="h-5 w-5" />,
      color: 'from-slate-500 to-gray-500',
      autoMessages: [
        'Hi! I wanted to reach out and connect with you.',
        'Hello! I hope this message finds you well.',
      ],
    },
  ];
  const visibleQueryTypes = queryTypes.filter((queryType) => {
    if (!isAssociationQueryType(queryType.type)) {
      return true;
    }

    return visibleAssociationTypes.has(queryType.type);
  });

  const handleSend = (message: string) => {
    if (selectedType && message) {
      onSend(message, selectedType);
    }
  };

  useEffect(() => {
    if (selectedType && !visibleQueryTypes.some((queryType) => queryType.type === selectedType)) {
      setSelectedType(null);
    }
  }, [selectedType, visibleQueryTypes]);

  useEffect(() => {
    if (initialQueryType && visibleQueryTypes.some((queryType) => queryType.type === initialQueryType)) {
      setSelectedType(initialQueryType);
    }
  }, [initialQueryType, visibleQueryTypes]);

  if (!selectedType) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white">Start a conversation with {partnerName}</h3>
          <p className="mt-2 text-sm text-slate-400">Select what you would like to discuss</p>
        </div>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {visibleQueryTypes.map((qt) => (
            <button
              key={qt.type}
              onClick={() => setSelectedType(qt.type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${qt.color} text-white`}>
                {qt.icon}
              </div>
              <span className="text-sm font-medium text-white">{qt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const currentType = visibleQueryTypes.find((qt) => qt.type === selectedType);
  if (!currentType) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <button
        onClick={() => setSelectedType(null)}
        className="self-start text-sm text-slate-400 transition hover:text-white"
      >
        ← Back
      </button>
      <div className="text-center">
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${currentType.color} text-white`}>
          {currentType.icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{currentType.label}</h3>
      </div>
      <div className="w-full max-w-md space-y-2">
        {currentType.autoMessages.map((msg, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(msg)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800"
          >
            {msg}
          </button>
        ))}
      </div>
      <div className="w-full max-w-md">
        <p className="mb-2 text-sm text-slate-400">Or write your own:</p>
        <div className="flex gap-2">
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-500"
          />
          <button
            onClick={() => handleSend(customMessage)}
            disabled={!customMessage.trim()}
            className="self-end rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationRequestStateCard({
  request,
  direction,
  partnerName,
  isUpdating,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  request: WorkflowRequest;
  direction: 'incoming' | 'outgoing';
  partnerName: string;
  isUpdating: boolean;
  onAccept: (request: WorkflowRequest) => void;
  onDecline: (request: WorkflowRequest) => void;
  onWithdraw: (request: WorkflowRequest) => void;
}) {
  const isPending = request.status === 'pending';
  const isAccepted = request.status === 'accepted';
  const isDeclined = request.status === 'declined';
  const isWithdrawn = request.status === 'withdrawn';
  const isExpired = request.status === 'expired';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-[1.5rem] border border-slate-800 bg-slate-900/60 px-6 py-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-cyan-300">
        <UserPlus className="h-7 w-7" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{getRequestTypeLabel(request)}</div>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {direction === 'incoming' ? `${partnerName} wants to connect` : `Request sent to ${partnerName}`}
        </h3>
        {request.message ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left text-sm leading-6 text-slate-200">
            {request.message}
          </div>
        ) : null}
      </div>

      {isPending && direction === 'incoming' ? (
        <>
          <p className="text-sm text-slate-400">
            Accept this conversation request to unlock direct messaging with {partnerName}.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onAccept(request)}
              disabled={isUpdating}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecline(request)}
              disabled={isUpdating}
              className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </>
      ) : null}

      {isPending && direction === 'outgoing' ? (
        <>
          <p className="text-sm text-slate-400">
            {partnerName} will see this request in Messages. Once accepted, both of you can start chatting here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Pending
            </span>
            <button
              type="button"
              onClick={() => onWithdraw(request)}
              disabled={isUpdating}
              className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
        </>
      ) : null}

      {isAccepted ? (
        <p className="text-sm text-emerald-300">
          Conversation request accepted. You can start chatting with {partnerName}.
        </p>
      ) : null}

      {isDeclined ? (
        <p className="text-sm text-rose-300">
          This conversation request was declined.
        </p>
      ) : null}

      {isWithdrawn ? (
        <p className="text-sm text-slate-400">
          This conversation request was withdrawn.
        </p>
      ) : null}

      {isExpired ? (
        <p className="text-sm text-slate-400">
          This conversation request expired before it was accepted.
        </p>
      ) : null}
    </div>
  );
}

function MessageBubble({
  msg,
  isMine,
  partnerName,
  currentUserName,
  showAvatar,
  statusText,
  onRemoveAttachment,
  disableAttachmentOpen = false,
  onQuickReply,
}: {
  msg: DMMessage;
  isMine: boolean;
  partnerName: string;
  currentUserName: string;
  showAvatar: boolean;
  statusText?: string;
  onRemoveAttachment?: () => void;
  disableAttachmentOpen?: boolean;
  onQuickReply?: (message: string) => void;
}) {
  const isImage = msg.attachmentType === 'image';
  const isPdf = msg.attachmentType === 'pdf';
  const investorPitch = msg.queryType === 'investor' ? parseInvestorPitch(msg.message) : null;
  const startupHandshake = parseStartupHandshake(msg.message);
  const attachmentImage = msg.attachmentUrl ? (
    <img
      src={msg.attachmentUrl}
      alt={msg.attachmentName || 'Image'}
      className="max-w-[280px] max-h-[300px] object-cover transition-opacity hover:opacity-90"
    />
  ) : null;
  const attachmentDocument = (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{msg.attachmentName || 'Document.pdf'}</p>
        <p className="text-xs text-slate-400">PDF</p>
      </div>
    </div>
  );

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-3' : 'mt-1'}`}>
      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
        {showAvatar && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
            {isMine ? initials(currentUserName) : initials(partnerName)}
          </div>
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`flex w-full max-w-[42rem] flex-col ${isMine ? 'items-end' : 'items-start'} ${msg.isOptimistic ? 'opacity-85' : ''}`}
      >
        {/* Attachment preview */}
        {msg.attachmentUrl && (
          <div className={`relative mb-1 overflow-hidden rounded-2xl ${isMine ? 'order-2' : 'order-1'}`}>
            {isImage ? (
              disableAttachmentOpen ? (
                attachmentImage
              ) : (
                <a href={msg.attachmentUrl} target="_blank" rel="noreferrer">
                  {attachmentImage}
                </a>
              )
            ) : isPdf ? (
              disableAttachmentOpen ? (
                attachmentDocument
              ) : (
                <a 
                  href={msg.attachmentUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="transition-colors hover:bg-slate-800"
                >
                  {attachmentDocument}
                </a>
              )
            ) : null}
            {onRemoveAttachment ? (
              <button
                type="button"
                onClick={onRemoveAttachment}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-slate-900"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {msg.attachmentName && isImage && (
              <p className={`px-2 py-1 text-xs text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                {msg.attachmentName}
              </p>
            )}
          </div>
        )}

        {/* Text message */}
        {msg.message && (
          msg.messageType === 'invitation' && msg.invitationType && msg.invitationData ? (
            <div className="order-1 w-full max-w-[320px]">
              <InvitationCard
                messageId={msg._id}
                invitationType={msg.invitationType}
                entityTitle={msg.invitationData.entityTitle}
                entityType={msg.invitationData.entityType}
                role={msg.invitationData.role}
                requestId={msg.invitationData.requestId}
                status={msg.invitationData.status}
                senderName={isMine ? currentUserName : partnerName}
                isMine={isMine}
              />
            </div>
          ) : investorPitch ? (
            <div className="order-1 w-full">
              <InvestorPitchCard details={investorPitch} isMine={isMine} />
            </div>
          ) : startupHandshake ? (
            <div className="order-1 w-full">
              <StartupHandshakeCard details={startupHandshake} isMine={isMine} />
            </div>
          ) : (
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                isMine
                  ? 'order-1 rounded-tr-sm bg-gradient-to-br from-cyan-600 to-cyan-700 text-white'
                  : 'order-1 rounded-tl-sm bg-slate-800 text-slate-100'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
            </div>
          )
        )}

        {/* Timestamp and read receipt */}
        <div className={`mt-1 flex items-center gap-1.5 ${isMine ? 'order-2 justify-end' : 'order-3 justify-start'}`}>
          <span className={`text-[11px] ${isMine ? 'text-cyan-300/60' : 'text-slate-500'}`}>
            {statusText ?? dt(msg.sentAt)}
          </span>
          {!statusText ? <ReadReceipt readAt={msg.readAt} isMine={isMine} /> : null}
        </div>

        {/* Investor proposal quick-reply — shown only to the recipient */}
        {!isMine && msg.queryType === 'investor' && onQuickReply && (
          <InvestorProposalReplyActions
            senderName={partnerName}
            onAccept={() =>
              onQuickReply(`Hi! I've reviewed your startup and I'm interested in learning more. Let's schedule a call to discuss the investment opportunity.`)
            }
            onDecline={() =>
              onQuickReply(`Thank you for reaching out. After careful consideration, I'll pass on this opportunity for now. Best of luck with your venture!`)
            }
          />
        )}
      </div>
    </div>
  );
}

function PendingAttachmentDraftCard({
  attachment,
  partnerName,
  onRemove,
  onSend,
  sendDisabled,
}: {
  attachment: PendingAttachmentState;
  partnerName: string;
  onRemove: () => void;
  onSend: () => void;
  sendDisabled: boolean;
}) {
  const isImage = attachment.fileType === 'image';
  const statusLabel = attachment.isUploading ? 'Uploading attachment...' : 'Attachment ready to send';
  const statusHint = attachment.isUploading
    ? 'Please wait for the upload to finish before sending.'
    : `This ${isImage ? 'image' : 'file'} is still a draft. Click Send to deliver it to ${partnerName}.`;

  return (
    <div className="mb-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-cyan-100">{statusLabel}</div>
          <p className="mt-1 text-xs text-slate-300">{statusHint}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900/80 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          aria-label="Remove attachment draft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
        {isImage ? (
          <>
            <img
              src={attachment.previewUrl}
              alt={attachment.fileName}
              className="max-h-[240px] w-auto max-w-full rounded-xl object-cover"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span className="truncate">{attachment.fileName}</span>
              <span className="flex-shrink-0">{formatAttachmentSize(attachment.fileSize)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{attachment.fileName}</p>
              <p className="text-xs text-slate-400">PDF • {formatAttachmentSize(attachment.fileSize)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          {attachment.isUploading ? 'Upload in progress' : 'Draft is ready in the composer'}
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          className="inline-flex h-9 items-center justify-center rounded-full bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send {isImage ? 'image' : 'file'}
        </button>
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 border-t border-slate-800" />
      <span className="text-xs text-slate-500">{date}</span>
      <div className="flex-1 border-t border-slate-800" />
    </div>
  );
}

function ChatPanel({
  partnerName,
  partnerRole,
  isFirstContact,
  onSendWithQuery,
  initialQueryType,
  conversationRequest,
  conversationRequestDirection,
  conversationRequestUpdating,
  onAcceptConversationRequest,
  onDeclineConversationRequest,
  onWithdrawConversationRequest,
  dm,
}: {
  partnerName: string;
  partnerRole?: string;
  isFirstContact?: boolean;
  onSendWithQuery?: (message: string, queryType: QueryType) => void;
  initialQueryType?: QueryType | null;
  conversationRequest?: WorkflowRequest | null;
  conversationRequestDirection?: 'incoming' | 'outgoing' | null;
  conversationRequestUpdating?: boolean;
  onAcceptConversationRequest?: (request: WorkflowRequest) => void;
  onDeclineConversationRequest?: (request: WorkflowRequest) => void;
  onWithdrawConversationRequest?: (request: WorkflowRequest) => void;
  dm: DMHookState;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const { messages, sendMessage, sendTyping, typingFromPartner, isLoading } = dm;
  const [draft, setDraft] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => () => {
    if (pendingAttachment?.localObjectUrl) {
      URL.revokeObjectURL(pendingAttachment.localObjectUrl);
    }
  }, [pendingAttachment?.localObjectUrl]);

  const removeAttachment = useCallback(() => {
    setAttachmentError('');
    setPendingAttachment((current) => {
      if (current?.localObjectUrl) {
        URL.revokeObjectURL(current.localObjectUrl);
      }
      return null;
    });
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text && !pendingAttachment) return;
    if (pendingAttachment && !pendingAttachment.uploadedUrl) return;
    sendMessage({ 
      message: text, 
      messageType: 'text',
      attachmentUrl: pendingAttachment?.uploadedUrl,
      attachmentType: pendingAttachment?.fileType,
      attachmentName: pendingAttachment?.fileName,
    });
    setDraft('');
    removeAttachment();
    setShowAttachments(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentError('');

    const hasAllowedMimeType = allowedAttachmentMimeTypes.has(file.type);
    const hasAllowedExtension = allowedAttachmentExtensionPattern.test(file.name);
    if (!hasAllowedMimeType && !hasAllowedExtension) {
      setAttachmentError('Only PDF, JPEG, PNG, GIF, and WebP files are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > attachmentMaxSizeBytes) {
      setAttachmentError('File size must be 10MB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const localObjectUrl = URL.createObjectURL(file);
    const fileType = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      ? 'pdf'
      : 'image';

    removeAttachment();
    setPendingAttachment({
      previewUrl: localObjectUrl,
      localObjectUrl,
      fileType,
      fileName: file.name,
      fileSize: file.size,
      isUploading: true,
    });
    setIsUploading(true);
    try {
      const upload = await dmApi.uploadAttachment(file);
      setPendingAttachment((current) => {
        if (!current || current.localObjectUrl !== localObjectUrl) {
          URL.revokeObjectURL(localObjectUrl);
          return current;
        }

        return {
          ...current,
          previewUrl: upload.url,
          uploadedUrl: upload.url,
          fileType: upload.fileType,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          isUploading: false,
        };
      });
      setShowAttachments(false);
    } catch (err) {
      console.error('Upload failed:', err);
      setAttachmentError(getAttachmentUploadErrorMessage(err));
      setPendingAttachment((current) => {
        if (current?.localObjectUrl === localObjectUrl) {
          URL.revokeObjectURL(localObjectUrl);
          return null;
        }
        return current;
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Group messages by date
  const messagesWithDateSeparators: (DMMessage | { type: 'date'; date: string })[] = [];
  messages.forEach((msg, idx) => {
    const msgDate = formatMessageDate(msg.sentAt);
    const prevMsg = idx > 0 ? messages[idx - 1] : null;
    const prevDate = prevMsg ? formatMessageDate(prevMsg.sentAt) : null;

    if (idx === 0 || msgDate !== prevDate) {
      messagesWithDateSeparators.push({ type: 'date', date: msgDate });
    }
    messagesWithDateSeparators.push(msg);
  });

  const canCompose =
    !conversationRequest || conversationRequest.status === 'accepted';
  const shouldShowConversationRequestCard =
    Boolean(conversationRequest && conversationRequest.status !== 'accepted' && conversationRequestDirection);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Thread */}
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">Loading messages...</div>
        ) : shouldShowConversationRequestCard && conversationRequest && conversationRequestDirection ? (
          <div className="flex h-full items-center justify-center">
            <ConversationRequestStateCard
              request={conversationRequest}
              direction={conversationRequestDirection}
              partnerName={partnerName}
              isUpdating={Boolean(conversationRequestUpdating)}
              onAccept={onAcceptConversationRequest ?? (() => undefined)}
              onDecline={onDeclineConversationRequest ?? (() => undefined)}
              onWithdraw={onWithdrawConversationRequest ?? (() => undefined)}
            />
          </div>
        ) : messages.length === 0 ? (
          isFirstContact && onSendWithQuery ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FirstContactPanel
                partnerName={partnerName}
                partnerRole={partnerRole}
                currentUserRole={currentUser?.role}
                onSend={onSendWithQuery}
                initialQueryType={initialQueryType}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center gap-3 text-slate-500">
              <MessageCircle className="h-10 w-10 opacity-30" />
              <p className="text-sm">Start a conversation with {partnerName}</p>
            </div>
          )
        ) : (
          <div>
            {messagesWithDateSeparators.map((item: any, idx) => {
              if (item.type === 'date') {
                return <DateSeparator key={`date-${idx}`} date={item.date} />;
              }
              const msg = item;
              const isMine = msg.senderId === currentUser?._id;
              const prevMsg = idx > 0 ? messages[messages.indexOf(item) - 1] : null;
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

              return (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  isMine={isMine}
                  partnerName={partnerName}
                  currentUserName={currentUser?.displayName ?? 'Me'}
                  showAvatar={showAvatar}
                  onQuickReply={(reply) => sendMessage({ message: reply, messageType: 'text', queryType: 'general' })}
                />
              );
            })}
            {/* Typing indicator */}
            {typingFromPartner ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <div className="flex h-6 w-12 items-center rounded-full bg-slate-800 px-3">
                  <div className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                <span>{partnerName} is typing...</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Input bar */}
      {canCompose ? (
      <div className="border-t border-slate-800 px-4 py-3">
        {/* Attachment picker */}
        {showAttachments && (
          <div className="mb-3 flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/50 p-3 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            >
              <Image className="h-6 w-6" />
              <span className="text-xs">Photo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/50 p-3 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            >
              <FileText className="h-6 w-6" />
              <span className="text-xs">Document</span>
            </button>
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                Uploading...
              </div>
            )}
          </div>
        )}

        {attachmentError ? (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {attachmentError}
          </div>
        ) : null}

        {pendingAttachment ? (
          <PendingAttachmentDraftCard
            attachment={pendingAttachment}
            partnerName={partnerName}
            onRemove={removeAttachment}
            onSend={handleSend}
            sendDisabled={isUploading || (!draft.trim() && !pendingAttachment)}
          />
        ) : null}

        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <Paperclip className={`h-5 w-5 transition-transform ${showAttachments ? 'rotate-45' : ''}`} />
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); sendTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${partnerName}...`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-500"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isUploading || (!draft.trim() && !pendingAttachment)}
            className={`flex h-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-40 ${
              pendingAttachment ? 'gap-2 px-4' : 'w-10'
            }`}
          >
            <Send className="h-4 w-4" />
            {pendingAttachment ? <span className="text-sm font-medium">Send</span> : null}
          </button>
        </div>
      </div>
      ) : null}
    </div>
  );
}

const STATUS_COLORS: Record<WorkflowRequest['status'], string> = {
  pending: 'text-amber-400',
  accepted: 'text-emerald-400',
  declined: 'text-red-400',
  withdrawn: 'text-slate-500',
  expired: 'text-slate-500',
  cancelled: 'text-slate-500',
  completed: 'text-cyan-400',
};

function RequestSidebarItem({
  request,
  direction,
  isActive,
  onClick,
}: {
  request: WorkflowRequest;
  direction: 'incoming' | 'outgoing';
  isActive?: boolean;
  onClick: (request: WorkflowRequest) => void;
}) {
  const actor = getRequestActorLabel(request, direction);
  const avatarLetter = actor.charAt(0).toUpperCase();
  const typeLabel = getRequestTypeLabel(request);
  const statusColor = STATUS_COLORS[request.status];
  const entityName = getRequestEntityName(request);

  return (
    <button
      type="button"
      onClick={() => onClick(request)}
      className={`flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition ${
        isActive ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'
      }`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-600 text-sm font-bold text-white">
        {avatarLetter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{actor}</div>
        <div className="truncate text-xs text-slate-500">{typeLabel}</div>
        <div className="truncate text-[11px] text-slate-600">{entityName}</div>
      </div>
      <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>
        {formatRequestStatus(request.status)}
      </span>
    </button>
  );
}

export function MessagesPage() {
  const { partnerId } = useParams<{ partnerId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{ _id: string; displayName: string; avatar?: string; role: string }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null);
  const [pendingPartnerName, setPendingPartnerName] = useState<string>('');
  const [pendingPartnerRole, setPendingPartnerRole] = useState<string>('');
  const [pendingQueryType, setPendingQueryType] = useState<QueryType | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showStartupInviteModal, setShowStartupInviteModal] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const dm = useDM(partnerId);
  const { partner: partnerProfile, isPartnerOnline, sendMessage } = dm;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (partnerId && currentUser?._id && partnerId === currentUser._id) {
      navigate('/dashboard/messages', { replace: true });
    }
  }, [currentUser?._id, navigate, partnerId]);

  const conversationsQuery = useQuery({
    queryKey: ['dm', 'conversations'],
    queryFn: dmApi.listConversations,
    refetchInterval: 30_000,
  });

  const isStudentRole = currentUser?.role === UserRole.STUDENT;
  const canAccessRequestsView = Boolean(
    currentUser?.role &&
      [
        UserRole.STUDENT,
        UserRole.SCHOOL,
        UserRole.COLLEGE,
        UserRole.MENTOR,
        UserRole.INVESTOR,
        UserRole.RECRUITER,
      ].includes(currentUser.role),
  );

  const startupsQuery = useQuery({
    queryKey: ['startups', 'mine'],
    queryFn: startupApi.mine,
    enabled: isStudentRole,
  });

  const myStartups = startupsQuery.data ?? [];
  const founderManagedStartups = currentUser?._id
    ? myStartups.filter((startup) => startup.founderIds.includes(currentUser._id))
    : [];

  // Fetched only when the Requests tab is active; React Query caches and deduplicates
  // with the same queries run inside <InvitationPage />.
  const incomingRequestsQuery = useQuery({
    queryKey: ['requests', 'incoming'],
    queryFn: requestApi.incoming,
    enabled: (canAccessRequestsView && searchParams.get('view') === 'requests') || Boolean(partnerId),
  });
  const outgoingRequestsQuery = useQuery({
    queryKey: ['requests', 'outgoing'],
    queryFn: requestApi.outgoing,
    enabled: (canAccessRequestsView && searchParams.get('view') === 'requests') || Boolean(partnerId),
  });
  const sidebarIncoming = incomingRequestsQuery.data ?? [];
  const sidebarOutgoing = outgoingRequestsQuery.data ?? [];
  const selectedRequestId = searchParams.get('requestId');
  const sidebarRequestEntries = [
    ...sidebarIncoming.map((request) => ({ request, direction: 'incoming' as const })),
    ...sidebarOutgoing.map((request) => ({ request, direction: 'outgoing' as const })),
  ];
  const hasSelectedRequest = sidebarRequestEntries.some((entry) => entry.request._id === selectedRequestId);

  const allConversations = conversationsQuery.data ?? [];
  const searchTerm = search.trim();
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const isGlobalSearchActive = searchTerm.length >= 2;
  const existingPartnerIds = useMemo(
    () => new Set(allConversations.map((conversation) => conversation.partnerId)),
    [allConversations],
  );
  const conversationMap = useMemo(
    () => new Map(allConversations.map((conversation) => [conversation.partnerId, conversation])),
    [allConversations],
  );
  const filteredConversations = useMemo(() => {
    if (!normalizedSearchTerm) {
      return allConversations;
    }

    return allConversations.filter((conversation) =>
      (conversation.partner?.displayName ?? '').toLowerCase().includes(normalizedSearchTerm),
    );
  }, [allConversations, normalizedSearchTerm]);
  const searchedConversations = useMemo(() => {
    if (!isGlobalSearchActive) {
      return [] as DMConversation[];
    }

    return userSearchResults
      .map((user) => conversationMap.get(user._id))
      .filter((conversation): conversation is DMConversation => Boolean(conversation));
  }, [conversationMap, isGlobalSearchActive, userSearchResults]);
  const searchedNewUsers = useMemo(() => {
    if (!isGlobalSearchActive) {
      return [] as typeof userSearchResults;
    }

    return userSearchResults.filter((user) => !existingPartnerIds.has(user._id));
  }, [existingPartnerIds, isGlobalSearchActive, userSearchResults]);
  const sidebarConversations = isGlobalSearchActive ? searchedConversations : filteredConversations;
  const conversations = sidebarConversations;
  const newUsers = searchedNewUsers;

  const activeConvo = allConversations.find((c) => c.partnerId === partnerId);
  const partnerName = activeConvo?.partner?.displayName
    ?? partnerProfile?.displayName
    ?? (partnerId ? 'Loading...' : 'Unknown');
  const partnerRole = activeConvo?.partner?.role ?? partnerProfile?.role ?? 'user';
  const normalizedPartnerRole = normalizeMessagingRole(partnerRole);
  const partnerAvatar = activeConvo?.partner?.avatar ?? partnerProfile?.avatar;
  const partnerOnline = activeConvo?.isOnline || isPartnerOnline;
  const visibleAssociationTypes = new Set(getVisibleAssociationQueryTypes(partnerRole, currentUser?.role));
  const startupInviteTarget: StartupInviteTarget | null =
    partnerId && founderManagedStartups.length > 0 && isStartupHandshakeTargetType(normalizedPartnerRole)
      ? {
          _id: partnerId,
          entityType: normalizedPartnerRole,
          displayName: partnerName,
        }
      : null;
  const startupActionConfig = startupInviteTarget
    ? getStartupHandshakeCardConfig(startupInviteTarget.entityType)
    : null;
  const requestedQueryType = (() => {
    const rawType = searchParams.get('queryType');
    return isValidQueryType(rawType) ? rawType : null;
  })();
  const contextualQueryType =
    requestedQueryType && (requestedQueryType === 'general' || visibleAssociationTypes.has(requestedQueryType))
      ? requestedQueryType
      : getAutoQueryTypeForRole(partnerRole, currentUser?.role);

  const [requestSentName, setRequestSentName] = useState<string | null>(null);
  const partnerConversationRequestEntry = useMemo(() => {
    if (!partnerId) {
      return null;
    }

    const entries = [
      ...sidebarIncoming.map((request) => ({ request, direction: 'incoming' as const })),
      ...sidebarOutgoing.map((request) => ({ request, direction: 'outgoing' as const })),
    ].filter(
      ({ request, direction }) =>
        request.type === 'generic' &&
        request.actionType === 'connect' &&
        request.targetEntityType === 'conversation' &&
        ((direction === 'incoming' && request.fromUserId === partnerId) ||
          (direction === 'outgoing' && request.toUserId === partnerId)),
    );

    if (entries.length === 0) {
      return null;
    }

    const priority = new Map<WorkflowRequest['status'], number>([
      ['pending', 0],
      ['accepted', 1],
      ['declined', 2],
      ['withdrawn', 3],
      ['expired', 4],
      ['cancelled', 5],
      ['completed', 6],
    ]);

    return [...entries].sort((left, right) => {
      const statusDelta = (priority.get(left.request.status) ?? 99) - (priority.get(right.request.status) ?? 99);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return new Date(right.request.updatedAt).getTime() - new Date(left.request.updatedAt).getTime();
    })[0];
  }, [partnerId, sidebarIncoming, sidebarOutgoing]);
  const partnerConversationRequest = partnerConversationRequestEntry?.request ?? null;
  const partnerConversationRequestDirection = partnerConversationRequestEntry?.direction ?? null;
  const canChatDirectly = Boolean(partnerId && (existingPartnerIds.has(partnerId) || partnerConversationRequest?.status === 'accepted'));
  const isFirstContact = Boolean(partnerId) && !canChatDirectly && !partnerConversationRequest;

  const refreshConversationState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] }),
      ...(partnerId ? [queryClient.invalidateQueries({ queryKey: ['dm', 'thread', partnerId] })] : []),
      ...(partnerId ? [queryClient.invalidateQueries({ queryKey: ['dm', 'partner', partnerId] })] : []),
    ]);
  }, [partnerId, queryClient]);

  const requestActionMutation = useMutation({
    mutationFn: async (params: { type: 'accept' | 'decline' | 'withdraw'; requestId: string }) => {
      if (params.type === 'accept') {
        return requestApi.accept(params.requestId);
      }
      if (params.type === 'decline') {
        return requestApi.decline(params.requestId);
      }
      return requestApi.withdraw(params.requestId);
    },
    onSuccess: async () => {
      await refreshConversationState();
    },
  });

  const handleSelect = (pid: string, pname: string, prole?: string) => {
    const hasConversationRequest = [...sidebarIncoming, ...sidebarOutgoing].some(
      (request) =>
        request.type === 'generic' &&
        request.actionType === 'connect' &&
        request.targetEntityType === 'conversation' &&
        (request.fromUserId === pid || request.toUserId === pid),
    );

    if (existingPartnerIds.has(pid) || hasConversationRequest) {
      navigate(`/dashboard/messages/${pid}`);
      queryClient.invalidateQueries({ queryKey: ['dm', 'thread', pid] });
      setSearch('');
      setUserSearchResults([]);
    } else {
      setPendingPartnerId(pid);
      setPendingPartnerName(pname);
      setPendingPartnerRole(prole ?? '');
      setPendingQueryType(getAutoQueryTypeForRole(prole, currentUser?.role));
      setShowQueryModal(true);
    }
  };

  const submitConversationRequest = useCallback(
    async (targetUserId: string, targetName: string, queryType: QueryType, message?: string) => {
      await requestApi.create({
        requestType: 'generic',
        actionType: 'connect',
        toUserId: targetUserId,
        targetEntityType: 'conversation',
        targetEntityId: targetUserId,
        targetEntityTitle: targetName || 'User',
        message: message || '',
        deepLink: `/dashboard/messages/${targetUserId}`,
        acceptRedirect: `/dashboard/messages/${targetUserId}`,
        metadata: { queryType },
      });
      setRequestSentName(targetName);
      await refreshConversationState();
    },
    [refreshConversationState],
  );

  const handleQuerySelect = async (queryType: QueryType, customMessage?: string) => {
    if (pendingPartnerId) {
      try {
        await submitConversationRequest(pendingPartnerId, pendingPartnerName || 'User', queryType, customMessage);
      } catch (err) {
        console.error('Failed to send conversation request:', err);
      }
      setSearch('');
      setUserSearchResults([]);
    }
    setShowQueryModal(false);
    setPendingPartnerId(null);
    setPendingPartnerName('');
    setPendingPartnerRole('');
    setPendingQueryType(null);
  };

  const handleReportUser = () => {
    setShowMenu(false);
    setShowReportModal(true);
  };

  const handleAcceptConversationRequest = useCallback(
    (request: WorkflowRequest) => {
      requestActionMutation.mutate({ type: 'accept', requestId: request._id });
    },
    [requestActionMutation],
  );

  const handleDeclineConversationRequest = useCallback(
    (request: WorkflowRequest) => {
      requestActionMutation.mutate({ type: 'decline', requestId: request._id });
    },
    [requestActionMutation],
  );

  const handleWithdrawConversationRequest = useCallback(
    (request: WorkflowRequest) => {
      requestActionMutation.mutate({ type: 'withdraw', requestId: request._id });
    },
    [requestActionMutation],
  );

  const handleStartupRequestCreated = useCallback(
    (payload: StartupHandshakeDmPayload) => {
      sendMessage({
        message: buildStartupHandshakeDmMessage(payload),
        messageType: 'text',
        queryType: 'general',
      });
    },
    [sendMessage],
  );

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

  const view: 'chats' | 'requests' =
    canAccessRequestsView && searchParams.get('view') === 'requests' ? 'requests' : 'chats';

  useEffect(() => {
    if (canAccessRequestsView || searchParams.get('view') !== 'requests') {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('requestId');
    setSearchParams(next, { replace: true });
  }, [canAccessRequestsView, searchParams, setSearchParams]);

  const switchToChats = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const switchToRequests = () => {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'requests');
    next.delete('queryType');
    setSearchParams(next, { replace: true });
  };

  const handleSelectRequest = (requestId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'requests');
    next.set('requestId', requestId);
    next.delete('queryType');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (view !== 'requests' || incomingRequestsQuery.isLoading || outgoingRequestsQuery.isLoading) {
      return;
    }

    if (sidebarRequestEntries.length === 0) {
      if (!selectedRequestId) {
        return;
      }

      const next = new URLSearchParams(searchParams);
      next.delete('requestId');
      setSearchParams(next, { replace: true });
      return;
    }

    if (selectedRequestId && hasSelectedRequest) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('view', 'requests');
    next.set('requestId', sidebarRequestEntries[0].request._id);
    next.delete('queryType');
    setSearchParams(next, { replace: true });
  }, [
    hasSelectedRequest,
    incomingRequestsQuery.isLoading,
    outgoingRequestsQuery.isLoading,
    searchParams,
    selectedRequestId,
    setSearchParams,
    sidebarRequestEntries,
    view,
  ]);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100%+3rem)] min-h-0 overflow-hidden bg-slate-950 lg:-mx-8">
      {/* Sidebar — conversation list */}
      <div
        className={`flex min-h-0 w-80 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 ${
          partnerId && view === 'chats' ? 'hidden lg:flex' : view === 'requests' ? 'hidden lg:flex' : 'flex w-full md:w-80'
        }`}
      >
        <div className="flex-none border-b border-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Messages</h2>
            {view === 'chats' ? (
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('#msg-search-input');
                  input?.focus();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="New message"
              >
                <PenSquare className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* View tabs */}
          <div className="mb-3 flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={switchToChats}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                view === 'chats' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chats
            </button>
            {canAccessRequestsView ? (
              <button
                type="button"
                onClick={switchToRequests}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                  view === 'requests' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Inbox className="h-3.5 w-3.5" />
                Requests
              </button>
            ) : null}
          </div>

          {view === 'chats' ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="msg-search-input"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500 placeholder:text-slate-500"
              />
            </div>
          ) : null}
        </div>

        {view === 'chats' ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : sidebarConversations.length === 0 && !searchTerm ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <MessageCircle className="h-10 w-10 text-slate-700" />
                <p className="text-sm text-slate-500">No conversations yet</p>
                <p className="text-xs leading-relaxed text-slate-600">
                  Type a name above to find people you can message. Try searching by role, domain, or institution.
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
                    onClick={() => handleSelect(convo.partnerId, convo.partner?.displayName ?? 'Unknown', convo.partner?.role)}
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
                          onClick={() => handleSelect(user._id, user.displayName, user.role)}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:bg-slate-800/60"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
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
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                            New
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {search.trim().length >= 2 && conversations.length === 0 && newUsers.length === 0 && !isSearchingUsers ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                    <Search className="h-6 w-6 text-slate-700" />
                    <p className="text-xs text-slate-500">No users found matching &ldquo;{search}&rdquo;</p>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Search matches active users by name or email. Try a different search term if this person still does not appear.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          /* Requests view — list incoming then outgoing by user name */
          <div className="min-h-0 flex-1 overflow-y-auto">
            {incomingRequestsQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
            ) : sidebarIncoming.length === 0 && sidebarOutgoing.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Inbox className="h-10 w-10 text-slate-700" />
                <p className="text-sm text-slate-500">No requests yet.</p>
              </div>
            ) : (
              <>
                {sidebarIncoming.length > 0 && (
                  <>
                    <div className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Incoming
                    </div>
                    {sidebarIncoming.map((req) => (
                      <RequestSidebarItem
                        key={req._id}
                        request={req}
                        direction="incoming"
                        isActive={selectedRequestId === req._id}
                        onClick={(request) => handleSelectRequest(request._id)}
                      />
                    ))}
                  </>
                )}
                {sidebarOutgoing.length > 0 && (
                  <>
                    <div className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Outgoing
                    </div>
                    {sidebarOutgoing.map((req) => (
                      <RequestSidebarItem
                        key={req._id}
                        request={req}
                        direction="outgoing"
                        isActive={selectedRequestId === req._id}
                        onClick={(request) => handleSelectRequest(request._id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Main area — chat or requests */}
      <div className="flex min-h-0 flex-1 flex-col">
        {view === 'requests' ? (
          <>
            {/* Mobile header — tabs shown here since sidebar is hidden on small screens */}
            <div className="flex-none border-b border-slate-800 px-4 py-3 lg:hidden">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Messages</h2>
                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                  <button
                    type="button"
                    onClick={switchToChats}
                    className="flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chats
                  </button>
                  <button
                    type="button"
                    onClick={switchToRequests}
                    className="flex items-center justify-center gap-1.5 rounded-md bg-slate-800 px-4 py-1.5 text-xs font-medium text-white transition"
                  >
                    <Inbox className="h-3.5 w-3.5" />
                    Requests
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6">
              <InvitationPage
                selectedRequestId={selectedRequestId}
                onSelectRequest={handleSelectRequest}
              />
            </div>
          </>
        ) : partnerId ? (
          <>
            {/* Header */}
            <div className="flex-none border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/messages')}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
                    {partnerAvatar ? (
                      <img
                        src={partnerAvatar}
                        alt={partnerName}
                        className="h-10 w-10 rounded-full object-cover"
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
                  <div className="text-sm font-semibold text-white">{partnerName}</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={partnerOnline ? 'text-emerald-400' : 'text-slate-500'}>
                      {partnerOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize text-slate-500">{partnerRole}</span>
                  </div>
                </div>
                {canChatDirectly && startupInviteTarget && startupActionConfig ? (
                  <button
                    type="button"
                    onClick={() => setShowStartupInviteModal(true)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/10 ${startupActionConfig.iconClassName}`}
                    title={`Send a startup ${getStartupHandshakeActionLabel(startupInviteTarget.entityType).toLowerCase()} request`}
                  >
                    {startupActionConfig.icon}
                    <span className="hidden sm:inline">
                      {getStartupHandshakeActionLabel(startupInviteTarget.entityType)}
                    </span>
                  </button>
                ) : null}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setShowMenu(!showMenu)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    title="More options"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                      <button
                        type="button"
                        onClick={handleReportUser}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-slate-800"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Report User
                      </button>
                      {visibleAssociationTypes.size > 0 && !startupInviteTarget ? (
                        <div className="border-t border-slate-700 px-4 py-2">
                          <p className="mb-2 text-xs font-medium text-slate-400">Associate as:</p>
                          <div className="space-y-1">
                            {visibleAssociationTypes.has('project_mentor') ? (
                              <button
                                type="button"
                                disabled={!partnerId || !canChatDirectly}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I would like to associate you as a Project Mentor for my project.', messageType: 'text', queryType: 'project_mentor' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-blue-400 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <GraduationCap className="h-4 w-4" />
                                Project Mentor
                              </button>
                            ) : null}
                            {visibleAssociationTypes.has('project_join') ? (
                              <button
                                type="button"
                                disabled={!partnerId || !canChatDirectly}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I would love to join your project if you are open to collaborators.', messageType: 'text', queryType: 'project_join' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fuchsia-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Users className="h-4 w-4" />
                                Project Join
                              </button>
                            ) : null}
                            {visibleAssociationTypes.has('investor') ? (
                              <button
                                type="button"
                                disabled={!partnerId || !canChatDirectly}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I have an exciting startup that I would like to share with you and discuss as a potential investor.', messageType: 'text', queryType: 'investor' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-emerald-400 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <TrendingUp className="h-4 w-4" />
                                Investor
                              </button>
                            ) : null}
                            {visibleAssociationTypes.has('recruiter') ? (
                              <button
                                type="button"
                                disabled={!partnerId || !canChatDirectly}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I am interested in career opportunities and would like to connect with you as a Recruiter.', messageType: 'text', queryType: 'recruiter' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-purple-400 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Building2 className="h-4 w-4" />
                                Recruiter
                              </button>
                            ) : null}
                            {visibleAssociationTypes.has('hiring_event') ? (
                              <button
                                type="button"
                                disabled={!partnerId || !canChatDirectly}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I would like to organize a hiring event with your college and discuss student talent for open roles.', messageType: 'text', queryType: 'hiring_event' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-amber-400 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Calendar className="h-4 w-4" />
                                Hiring Event
                              </button>
                            ) : null}
                            {visibleAssociationTypes.has('mentorship_program') ? (
                              <button
                                type="button"
                                disabled={!partnerId}
                                onClick={() => {
                                  if (partnerId) {
                                    sendMessage({ message: 'Hi! I would like to support your students through a mentorship program and discuss the request details.', messageType: 'text', queryType: 'mentorship_program' });
                                    setShowMenu(false);
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-cyan-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <GraduationCap className="h-4 w-4" />
                                Mentorship Program
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {startupInviteTarget && startupActionConfig ? (
                        <div className="border-t border-slate-700 px-4 py-2">
                          <button
                            type="button"
                            disabled={!partnerId}
                            onClick={() => {
                              setShowMenu(false);
                              setShowStartupInviteModal(true);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {startupActionConfig.icon}
                            {getStartupHandshakeActionLabel(startupInviteTarget.entityType)}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <ChatPanel 
              partnerName={partnerName} 
              partnerRole={partnerRole}
              isFirstContact={isFirstContact}
              initialQueryType={isFirstContact ? contextualQueryType : null}
              conversationRequest={partnerConversationRequest}
              conversationRequestDirection={partnerConversationRequestDirection}
              conversationRequestUpdating={requestActionMutation.isPending}
              onAcceptConversationRequest={handleAcceptConversationRequest}
              onDeclineConversationRequest={handleDeclineConversationRequest}
              onWithdrawConversationRequest={handleWithdrawConversationRequest}
              dm={dm}
              onSendWithQuery={async (message, queryType) => {
                if (!partnerId) {
                  return;
                }
                if (searchParams.has('queryType')) {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('queryType');
                  setSearchParams(nextParams, { replace: true });
                }
                await submitConversationRequest(partnerId, partnerName, queryType, message);
              }}
            />
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center px-4">
            {requestSentName ? (
              <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-300">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-semibold">Conversation request sent to {requestSentName}</span>
                </div>
                <p className="mt-1 text-xs text-emerald-200/70">
                  They will see your request in their inbox. Once accepted, you can start chatting.
                </p>
                <button
                  type="button"
                  onClick={() => setRequestSentName(null)}
                  className="mt-3 text-xs text-emerald-400 transition hover:text-emerald-300"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/60">
              <MessageCircle className="h-10 w-10 text-slate-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Your Messages</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Search for people by name to start a direct conversation, or browse the Marketplace to discover users you can connect with.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('#msg-search-input');
                  if (input) {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
              >
                <UserPlus className="h-4 w-4" />
                Find People
              </button>
              <button
                type="button"
                onClick={() => navigate(getMarketplaceBasePath(currentUser?.role))}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10"
              >
                <Search className="h-4 w-4" />
                Browse Marketplace
              </button>
            </div>
          </div>
        )}
      </div>

      <QueryTypeModal
        isOpen={showQueryModal}
        onClose={() => {
          setShowQueryModal(false);
          setPendingPartnerId(null);
          setPendingPartnerName('');
          setPendingPartnerRole('');
        }}
        onSelect={handleQuerySelect}
        recipientName={pendingPartnerName}
        recipientRole={pendingPartnerRole}
        currentUserRole={currentUser?.role}
        initialQueryType={pendingQueryType}
      />

      {partnerId && (
        <ReportUserModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={partnerId}
          reportedUserName={partnerName}
        />
      )}

      <StartupInviteModal
        isOpen={showStartupInviteModal}
        onClose={() => setShowStartupInviteModal(false)}
        target={startupInviteTarget}
        onRequestCreated={handleStartupRequestCreated}
      />
    </div>
  );
}
