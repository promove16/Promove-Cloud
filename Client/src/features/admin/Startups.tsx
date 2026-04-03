import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CheckCircle2, Clock3, FileText, Rocket, RotateCcw, ShieldCheck } from 'lucide-react';
import { adminApi, AdminStartupReviewItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { StartupReviewStatus } from '../../types/startup.types';
import {
  STARTUP_IPR_QUESTION_LABELS,
  formatStartupIprValue,
} from '../startup/iprIntake';

const reviewTone: Record<StartupReviewStatus, string> = {
  draft: 'border-slate-700 bg-slate-900 text-slate-300',
  review_requested: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  changes_requested: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const statusOptions: Array<{ value: StartupReviewStatus | 'all'; label: string }> = [
  { value: 'review_requested', label: 'Pending Review' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Drafts' },
  { value: 'all', label: 'All Startups' },
];

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to update startup review right now.';
  }

  return error instanceof Error ? error.message : 'Unable to update startup review right now.';
};

export default function Startups() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StartupReviewStatus | 'all'>('review_requested');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notesByStartup, setNotesByStartup] = useState<Record<string, string>>({});

  const startupsQuery = useQuery({
    queryKey: ['admin-startup-reviews', status],
    queryFn: () => adminApi.getStartupReviews(status === 'all' ? undefined : { status }),
    refetchInterval: 60_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (params: {
      startupId: string;
      payload: { decision: 'approved' | 'changes_requested'; adminNotes?: string };
    }) => adminApi.reviewStartup(params.startupId, params.payload),
    onSuccess: async () => {
      setFeedback('Startup review updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-startup-reviews'] });
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error));
    },
  });

  const startups = startupsQuery.data ?? [];
  const pendingCount = useMemo(
    () => startups.filter((startup) => startup.reviewStatus === 'review_requested').length,
    [startups],
  );

  const handleReview = (startup: AdminStartupReviewItem, decision: 'approved' | 'changes_requested') => {
    const adminNotes = notesByStartup[startup._id]?.trim();

    if (decision === 'changes_requested' && !adminNotes) {
      setFeedback('Admin notes are required when requesting changes.');
      return;
    }

    setFeedback(null);
    reviewMutation.mutate({
      startupId: startup._id,
      payload: {
        decision,
        ...(adminNotes ? { adminNotes } : {}),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admin Startups</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Startup review queue</h1>
          <p className="mt-2 max-w-4xl text-slate-400">
            Review startup launch submissions before they go live in investor discovery. This queue now shows entity setup readiness, required documents, and launch compliance in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {pendingCount} pending in current filter
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StartupReviewStatus | 'all')}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {feedback}
        </div>
      ) : null}

      {startupsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : startups.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">No startup submissions match this review filter.</Card>
      ) : (
        <div className="space-y-4">
          {startups.map((startup) => (
            <Card key={startup._id} className="p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={reviewTone[startup.reviewStatus] ?? reviewTone.draft}>
                      {startup.reviewStatus.replace(/_/g, ' ')}
                    </Badge>
                    <Badge>{startup.stage}</Badge>
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">{startup.category}</Badge>
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                      {formatStartupIprValue('ipProtectionType', startup.registrationProfile.ipProtectionType)}
                    </Badge>
                    {startup.launchedToInvestors ? (
                      <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Investor marketplace live</Badge>
                    ) : null}
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold text-white">{startup.name}</h2>
                    <p className="mt-2 text-slate-300">{startup.tagline}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Founders</div>
                      <div className="mt-2 text-sm text-white">
                        {startup.founders.map((founder) => founder.displayName).join(', ') || 'No founders mapped'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Products / Team</div>
                      <div className="mt-2 text-sm text-white">
                        {startup.activeProducts} active products / {startup.teamSize} team members
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Timeline</div>
                      <div className="mt-2 text-sm text-white">
                        Submitted {startup.reviewRequestedAt ? new Date(startup.reviewRequestedAt).toLocaleString('en-IN') : 'Not submitted'}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Reviewed {startup.adminReviewedAt ? new Date(startup.adminReviewedAt).toLocaleString('en-IN') : 'Pending'}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">IPR Intake Summary</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div>
                          <span className="text-slate-500">Innovation stage:</span>{' '}
                          {formatStartupIprValue('developmentStage', startup.registrationProfile.developmentStage)}
                        </div>
                        <div>
                          <span className="text-slate-500">Inventors:</span>{' '}
                          {formatStartupIprValue('inventorOwnership', startup.registrationProfile.inventorOwnership)}
                        </div>
                        <div>
                          <span className="text-slate-500">Commercialization:</span>{' '}
                          {formatStartupIprValue(
                            'commercializationStrategy',
                            startup.registrationProfile.commercializationStrategy,
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500">Protection sought:</span>{' '}
                          {formatStartupIprValue('ipProtectionType', startup.registrationProfile.ipProtectionType)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <ShieldCheck className="h-4 w-4" />
                        Review Readiness
                      </div>
                      <div className="mt-3">
                        <Badge className={startup.readiness.isReviewReady ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}>
                          {startup.readiness.isReviewReady ? 'Ready for approval' : 'Readiness incomplete'}
                        </Badge>
                      </div>
                      <div className="mt-3 text-sm text-slate-300">
                        {startup.readiness.isReviewReady
                          ? 'All required fields and document categories are satisfied.'
                          : startup.readiness.missingItems.slice(0, 5).join(', ')}
                        {!startup.readiness.isReviewReady && startup.readiness.missingItems.length > 5
                          ? `, and ${startup.readiness.missingItems.length - 5} more`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {startup.traction.patentFiled ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Patent filed</Badge> : null}
                    {startup.traction.mvpBuilt ? <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">MVP built</Badge> : null}
                    {startup.traction.revenueGenerating ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Revenue generating</Badge> : null}
                  </div>

                  {startup.pitchDeckUrl ? (
                    <a href={startup.pitchDeckUrl} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button variant="secondary">Open Pitch Deck</Button>
                    </a>
                  ) : null}

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <FileText className="h-4 w-4" />
                      IPR Intake Answers
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(startup.registrationProfile).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200">
                          <div className="text-xs uppercase tracking-[0.15em] text-slate-500">
                            {STARTUP_IPR_QUESTION_LABELS[key as keyof typeof STARTUP_IPR_QUESTION_LABELS]}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-white">
                            {formatStartupIprValue(key as keyof AdminStartupReviewItem['registrationProfile'], value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <FileText className="h-4 w-4" />
                      Uploaded Documents
                    </div>
                    {startup.documents.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {startup.documents.map((document) => (
                          <a
                            key={document._id}
                            href={document.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200 transition hover:border-cyan-500/40"
                          >
                            <div className="font-medium text-white">{document.fileName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {document.category.replace(/_/g, ' ')} / {new Date(document.uploadedAt).toLocaleDateString('en-IN')}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">No legal or compliance documents uploaded yet.</div>
                    )}
                  </div>

                  {startup.adminNotes ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
                      Latest admin notes: {startup.adminNotes}
                    </div>
                  ) : null}
                </div>

                <div className="w-full max-w-xl space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Review Notes</div>
                    <textarea
                      value={notesByStartup[startup._id] ?? ''}
                      onChange={(event) =>
                        setNotesByStartup((current) => ({
                          ...current,
                          [startup._id]: event.target.value,
                        }))
                      }
                      rows={5}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                      placeholder="Add notes for approval context or required changes"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => handleReview(startup, 'approved')} disabled={reviewMutation.isPending}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve Startup
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleReview(startup, 'changes_requested')}
                      disabled={reviewMutation.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Request Changes
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <Clock3 className="h-4 w-4 text-cyan-300" />
                      <div className="mt-3 text-sm font-semibold text-white">Admin gate</div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">
                        Launch to investor marketplace is blocked until approval.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <Rocket className="h-4 w-4 text-cyan-300" />
                      <div className="mt-3 text-sm font-semibold text-white">Publication</div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">
                        Approved startups can be launched by the student into investor discovery.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                      <div className="mt-3 text-sm font-semibold text-white">Deal flow</div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">
                        Investor "Express Interest" remains the entry point for negotiation and bidding.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
