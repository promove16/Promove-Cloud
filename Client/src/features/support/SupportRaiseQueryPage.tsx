import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Paperclip, Send, Sparkles, X } from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import {
  CreateSupportTicketPayload,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_DESCRIPTIONS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_RELATED_ENTITY_TYPES,
  SupportCategory,
  SupportPriority,
  SupportRelatedEntityType,
} from '../../types/support.types';
import { FAQ_ENTRIES, SUPPORT_USER_BASE_PATH, buildUserTicketPath } from './supportShared';

type AttachmentDraft = {
  id: string;
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
};

export default function SupportRaiseQueryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initialCategory = (searchParams.get('category') as SupportCategory | null) ?? 'other';
  const initialTitle = searchParams.get('title') ?? '';
  const initialDescription = searchParams.get('description') ?? '';
  const initialPriority = (searchParams.get('priority') as SupportPriority | null) ?? 'medium';
  const initialRelatedEntityType =
    (searchParams.get('relatedEntityType') as SupportRelatedEntityType | null) ?? '';
  const initialRelatedEntityId = searchParams.get('relatedEntityId') ?? '';
  const initialReferenceText = searchParams.get('referenceText') ?? '';

  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState<SupportCategory>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<SupportPriority>(initialPriority);
  const [relatedEntityType, setRelatedEntityType] = useState<SupportRelatedEntityType | ''>(initialRelatedEntityType);
  const [relatedEntityId, setRelatedEntityId] = useState(initialRelatedEntityId);
  const [referenceText, setReferenceText] = useState(initialReferenceText);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const suggestedFaqs = useMemo(() => {
    const categoryMatches = FAQ_ENTRIES.filter((faq) => faq.category === category);
    if (!description.trim()) {
      return categoryMatches.slice(0, 3);
    }

    const needle = description.trim().toLowerCase();
    const keywordMatches = FAQ_ENTRIES.filter((faq) =>
      `${faq.question} ${faq.answer}`.toLowerCase().includes(needle.slice(0, 40)),
    );

    return Array.from(new Map([...categoryMatches, ...keywordMatches].map((faq) => [faq.id, faq])).values()).slice(
      0,
      3,
    );
  }, [category, description]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateSupportTicketPayload = {
        title: title.trim(),
        category,
        description: description.trim(),
        priority,
        ...(relatedEntityType ? { relatedEntityType } : {}),
        ...(relatedEntityId.trim() ? { relatedEntityId: relatedEntityId.trim() } : {}),
        ...(referenceText.trim() ? { referenceText: referenceText.trim() } : {}),
        ...(attachments.length
          ? {
              attachments: attachments.map(({ id: _id, ...rest }) => rest),
            }
          : {}),
      };

      return supportApi.createTicket(payload);
    },
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      navigate(buildUserTicketPath(ticket._id));
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit the ticket right now.');
    },
  });

  const addAttachment = () => {
    if (!newAttachmentUrl.trim() || !newAttachmentName.trim()) {
      return;
    }

    setAttachments((current) => [
      ...current,
      {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: newAttachmentUrl.trim(),
        name: newAttachmentName.trim(),
      },
    ]);
    setNewAttachmentUrl('');
    setNewAttachmentName('');
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  };

  const canSubmit =
    title.trim().length >= 4 &&
    description.trim().length >= 15 &&
    !createMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-4 px-6 py-6 lg:px-8">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-cyan-300">
            <Link to={SUPPORT_USER_BASE_PATH} className="hover:text-cyan-200">
              Help Desk
            </Link>
            <span>/</span>
            <span>New Query</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Raise a support ticket</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-400">
            Describe the issue clearly and attach any reference material. A support team member will pick it up
            and respond through this ticket.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr),minmax(280px,0.65fr)]">
        <Card className="space-y-6 border-slate-800 bg-slate-950/90 p-6">
          <div>
            <label className="text-sm font-semibold text-slate-200">Title</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Short summary of the issue"
              maxLength={200}
              className="mt-2 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Category</label>
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SUPPORT_CATEGORIES.map((option) => {
                const active = option === category;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{SUPPORT_CATEGORY_LABELS[option]}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      {SUPPORT_CATEGORY_DESCRIPTIONS[option]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              maxLength={8000}
              placeholder="Describe what you did, what you expected, and what happened instead. Include any error messages."
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Minimum 15 characters.</span>
              <span>{description.trim().length} characters</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-200">Priority</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUPPORT_PRIORITIES.map((option) => {
                  const active = priority === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPriority(option)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        active
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {SUPPORT_PRIORITY_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-200">Related entity (optional)</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  value={relatedEntityType}
                  onChange={(event) => setRelatedEntityType(event.target.value as SupportRelatedEntityType | '')}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">None</option>
                  {SUPPORT_RELATED_ENTITY_TYPES.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity}
                    </option>
                  ))}
                </select>
                <Input
                  value={relatedEntityId}
                  onChange={(event) => setRelatedEntityId(event.target.value)}
                  placeholder="Entity id (e.g. workspaceId)"
                  className="border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
                />
              </div>
              <Input
                value={referenceText}
                onChange={(event) => setReferenceText(event.target.value)}
                placeholder="Or free-text reference (URL, ID, etc.)"
                className="mt-2 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Attachments (optional)</label>
            <div className="mt-2 space-y-2">
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="h-4 w-4 text-cyan-300" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
                <Input
                  value={newAttachmentName}
                  onChange={(event) => setNewAttachmentName(event.target.value)}
                  placeholder="File name"
                  className="border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
                />
                <Input
                  value={newAttachmentUrl}
                  onChange={(event) => setNewAttachmentUrl(event.target.value)}
                  placeholder="Public upload URL"
                  className="border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
                />
                <Button type="button" variant="secondary" onClick={addAttachment}>
                  Attach
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                Upload files using the built-in uploader or any public HTTPS file URL, then paste the link here.
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
              className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              <Send className="h-4 w-4" />
              Submit Ticket
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTitle('');
                setDescription('');
                setPriority('medium');
                setRelatedEntityType('');
                setRelatedEntityId('');
                setReferenceText('');
                setAttachments([]);
                setErrorMessage(null);
              }}
              disabled={createMutation.isPending}
            >
              Reset
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-950/90 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Suggested FAQs</div>
                <div className="mt-2 text-base font-semibold text-white">Your issue may already be answered</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {suggestedFaqs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-xs text-slate-500">
                  No FAQ match detected yet. Keep typing or submit the ticket.
                </div>
              ) : (
                suggestedFaqs.map((faq) => (
                  <div key={faq.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <div className="text-sm font-semibold text-white">{faq.question}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{faq.answer}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-950/90 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">AI Help (beta)</div>
                <div className="mt-2 text-base font-semibold text-white">Smart triage is coming soon</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  AI-assisted resolution hints will run on the description and related entity context before a human
                  agent sees the ticket. For now, the structured form and FAQs above give the team everything they
                  need to act fast.
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-950/90 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-emerald-300">What happens next</div>
                <ul className="mt-3 space-y-2 text-xs text-slate-400">
                  <li>1. You will get a unique ticket code.</li>
                  <li>2. Support reviews, replies, and may request more info.</li>
                  <li>3. You are notified on every update.</li>
                  <li>4. Rate the resolution when it is marked as resolved.</li>
                </ul>
                <div className="mt-4">
                  <Badge className="border-slate-700 bg-slate-950 text-slate-200">
                    SLA by priority — urgent ≤ 4h
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
