import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, Gavel, Lightbulb, Rocket, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  mentorApi,
  MentorBidOpportunity,
  MentorBidOpportunityKind,
  SubmitMentorBidPayload,
} from '../../api/mentor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';

// ─── Submit Proposal Modal ─────────────────────────────────────────────────

interface SubmitBidModalProps {
  opportunity: MentorBidOpportunity;
  onClose: () => void;
  onSuccess: () => void;
}

const BID_STATUS_COLORS = {
  pending: 'text-amber-400',
  accepted: 'text-emerald-400',
  rejected: 'text-red-400',
  withdrawn: 'text-slate-400',
};

function getApiError(error: unknown) {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to submit your bid. Please try again.';
  }
  return error instanceof Error ? error.message : 'Unable to submit your bid. Please try again.';
}

function SubmitBidModal({ opportunity, onClose, onSuccess }: SubmitBidModalProps) {
  const queryClient = useQueryClient();
  const [expertise, setExpertise] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('4');
  const [proposedDurationWeeks, setProposedDurationWeeks] = useState('8');
  const [coverNote, setCoverNote] = useState('');
  const [errors, setErrors] = useState<{ expertise?: string; coverNote?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SubmitMentorBidPayload) => mentorApi.submitBid(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentor-bid-opportunities'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-my-bids'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
      onSuccess();
    },
    onError: (err) => setApiError(getApiError(err)),
  });

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!expertise.trim()) nextErrors.expertise = 'Describe your relevant expertise.';
    if (!coverNote.trim()) nextErrors.coverNote = 'A cover note is required.';
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }

    mutation.mutate({
      opportunityId: opportunity._id,
      kind: opportunity.kind,
      expertise: expertise.trim(),
      hoursPerWeek: Math.max(1, Number(hoursPerWeek)),
      proposedDurationWeeks: Math.max(1, Number(proposedDurationWeeks)),
      coverNote: coverNote.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Submit Proposal</div>
            <h2 className="mt-1 text-xl font-bold text-white">{opportunity.title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {opportunity.kind === 'startup' ? opportunity.startupName : opportunity.institution ?? 'Problem Bank'}
              {' · '}
              {opportunity.domain}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Relevant Expertise */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">
              Relevant Expertise <span className="text-red-400">*</span>
            </label>
            <Input
              value={expertise}
              onChange={(e) => { setExpertise(e.target.value); setErrors((prev) => ({ ...prev, expertise: undefined })); }}
              placeholder="e.g. Product-Market Fit, EdTech, Full-stack dev"
              className={errors.expertise ? 'border-red-500' : ''}
            />
            {errors.expertise && <span className="text-xs text-red-400">{errors.expertise}</span>}
          </div>

          {/* Time commitment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Hours / Week</label>
              <select
                className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
              >
                {[1, 2, 4, 6, 8, 10, 12, 16].map((h) => (
                  <option key={h} value={h}>{h} hrs / week</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Duration (Weeks)</label>
              <select
                className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white"
                value={proposedDurationWeeks}
                onChange={(e) => setProposedDurationWeeks(e.target.value)}
              >
                {[2, 4, 6, 8, 12, 16, 24].map((w) => (
                  <option key={w} value={w}>{w} weeks</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cover Note */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">
              Cover Note <span className="text-red-400">*</span>{' '}
              <span className="text-slate-600">(shown to the requester)</span>
            </label>
            <textarea
              value={coverNote}
              onChange={(e) => { setCoverNote(e.target.value); setErrors((prev) => ({ ...prev, coverNote: undefined })); }}
              rows={4}
              maxLength={800}
              placeholder="Why are you the right mentor for this? What specific value will you bring? What outcome do you commit to?"
              className={`w-full resize-none rounded-lg border bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${errors.coverNote ? 'border-red-500' : 'border-slate-700'}`}
            />
            <div className="flex items-center justify-between">
              {errors.coverNote
                ? <span className="text-xs text-red-400">{errors.coverNote}</span>
                : <span />}
              <span className="text-xs text-slate-600">{coverNote.length}/800</span>
            </div>
          </div>

          {apiError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {apiError}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-800 px-6 py-4 sm:flex-row">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1">
            {mutation.isPending ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Opportunity Card ──────────────────────────────────────────────────────

function OpportunityCard({ opp, onBid }: { opp: MentorBidOpportunity; onBid: () => void }) {
  const kindIcon = opp.kind === 'startup' ? Rocket : Lightbulb;
  const KindIcon = kindIcon;
  const kindLabel = opp.kind === 'startup' ? 'Startup' : 'Problem Bank';
  const kindColor = opp.kind === 'startup' ? 'text-cyan-300' : 'text-violet-300';

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${opp.kind === 'startup' ? 'bg-cyan-500/10' : 'bg-violet-500/10'}`}>
            <KindIcon className={`h-5 w-5 ${kindColor}`} />
          </div>
          <div>
            <div className={`text-xs uppercase tracking-[0.25em] ${kindColor}`}>{kindLabel}</div>
            <h3 className="mt-1 font-semibold text-white">{opp.title}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {opp.kind === 'startup' ? opp.startupName : opp.institution ?? 'Open Problem'}
              {opp.stage ? ` · ${opp.stage}` : ''}
              {' · '}
              {opp.domain}
            </p>
            {opp.preferredExpertise && opp.preferredExpertise.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {opp.preferredExpertise.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm text-slate-300">{opp.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-xs text-slate-500">
            {new Date(opp.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
          {opp.hasBid ? (
            <div className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Bid Sent
            </div>
          ) : (
            <Button onClick={onBid}>
              <Gavel className="mr-1.5 h-3.5 w-3.5" />
              Bid
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

type TabKey = 'opportunities' | 'my_bids';

const tabLabels: Record<TabKey, string> = {
  opportunities: 'Opportunities',
  my_bids: 'My Bids',
};

type KindFilter = 'all' | MentorBidOpportunityKind;

export default function MentorMarketplace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('opportunities');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedOpp, setSelectedOpp] = useState<MentorBidOpportunity | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const opportunitiesQuery = useQuery({
    queryKey: ['mentor-bid-opportunities'],
    queryFn: mentorApi.getBidOpportunities,
    refetchInterval: 60_000,
  });

  const myBidsQuery = useQuery({
    queryKey: ['mentor-my-bids'],
    queryFn: mentorApi.getMyBids,
    refetchInterval: 60_000,
  });

  const withdrawMutation = useMutation({
    mutationFn: mentorApi.withdrawBid,
    onSuccess: async () => {
      setSuccessMessage('Bid withdrawn successfully.');
      await queryClient.invalidateQueries({ queryKey: ['mentor-my-bids'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-bid-opportunities'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
    },
  });

  const opportunities = opportunitiesQuery.data ?? [];
  const myBids = myBidsQuery.data ?? [];

  const filteredOpportunities =
    kindFilter === 'all' ? opportunities : opportunities.filter((o) => o.kind === kindFilter);

  const startupCount = opportunities.filter((o) => o.kind === 'startup').length;
  const problemCount = opportunities.filter((o) => o.kind === 'problem_bank').length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Marketplace</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Bidding Opportunities</h1>
        <p className="mt-2 text-slate-400">
          Browse active startup and problem bank mentorship requests. Submit proposals to work with founders and student teams.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </div>
      )}

      {/* Summary row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{startupCount}</div>
          <div className="mt-1 text-sm text-slate-400">Startup Opportunities</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{problemCount}</div>
          <div className="mt-1 text-sm text-slate-400">Problem Bank Slots</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <Gavel className="h-5 w-5" />
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{myBids.filter((b) => b.status === 'pending').length}</div>
          <div className="mt-1 text-sm text-slate-400">Pending Bids</div>
        </Card>
      </div>

      <OptionTabs
        items={(Object.keys(tabLabels) as TabKey[]).map((t) => ({ id: t, label: tabLabels[t] }))}
        activeId={activeTab}
        onChange={setActiveTab}
        aria-label="Mentor marketplace tabs"
      />

      {/* OPPORTUNITIES tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {/* Kind filter */}
          <div className="flex gap-2">
            {(['all', 'startup', 'problem_bank'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                  kindFilter === k
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {k === 'all' ? 'All' : k === 'startup' ? 'Startups' : 'Problem Bank'}
              </button>
            ))}
          </div>

          {opportunitiesQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              <p className="text-slate-400">No opportunities found. Check back soon.</p>
            </div>
          ) : (
            filteredOpportunities.map((opp) => (
              <OpportunityCard key={opp._id} opp={opp} onBid={() => setSelectedOpp(opp)} />
            ))
          )}
        </div>
      )}

      {/* MY BIDS tab */}
      {activeTab === 'my_bids' && (
        <div className="space-y-4">
          {myBidsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : myBids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-16 text-center">
              <Gavel className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              <p className="text-slate-400">You haven't submitted any bids yet.</p>
              <button
                onClick={() => setActiveTab('opportunities')}
                className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-400 hover:underline"
              >
                Browse opportunities <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            myBids.map((bid) => (
              <Card key={bid._id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge>{bid.kind === 'startup' ? 'Startup' : 'Problem Bank'}</Badge>
                      <span className={`text-xs font-semibold uppercase tracking-widest ${BID_STATUS_COLORS[bid.status]}`}>
                        {bid.status}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-white">{bid.opportunityTitle}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {bid.expertise} · {bid.hoursPerWeek} hrs/week · {bid.proposedDurationWeeks} weeks
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {new Date(bid.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {bid.status === 'pending' && (
                    <Button
                      variant="secondary"
                      onClick={() => withdrawMutation.mutate(bid._id)}
                      disabled={withdrawMutation.isPending}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Submit Bid Modal */}
      {selectedOpp && (
        <SubmitBidModal
          opportunity={selectedOpp}
          onClose={() => setSelectedOpp(null)}
          onSuccess={() => {
            setSelectedOpp(null);
            setSuccessMessage(`Proposal submitted for "${selectedOpp.title}".`);
            setActiveTab('my_bids');
          }}
        />
      )}
    </div>
  );
}
