import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ExternalLink, FileText, GitBranch, TrendingUp, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminDealReviewItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('en-IN');

const transferTone: Record<string, string> = {
  not_started: 'border-slate-700 bg-slate-900 text-slate-300',
  pending_review: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  under_review: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const breakdownLabels: Record<string, string> = {
  problemsClaimed: 'Problems Claimed',
  problemsCompleted: 'Problems Completed',
  skillsCompleted: 'Skills Completed',
  progressUploads: 'Progress Uploads',
  patentsSubmitted: 'Patents Submitted',
  patentsApproved: 'Patents Approved',
  mvpsVerified: 'MVPs Verified',
  marketReadyVerified: 'Market Ready',
  startupsLaunched: 'Startups Launched',
};

const money = (value?: number | null) => currency.format(value ?? 0);
const pct = (value?: number | null) => `${(value ?? 0).toFixed(value && value % 1 !== 0 ? 2 : 0)}%`;
const dt = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Pending';
const d = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Pending';
const role = (value?: string) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Pending');
const trigger = (value: string) =>
  value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 border border-slate-800 bg-slate-950 px-4 py-4">
      <div className="break-words text-[11px] uppercase tracking-[0.26em] text-slate-500">{label}</div>
      <div className="mt-3 min-w-0 break-words text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 min-w-0 break-all text-sm text-slate-400">{detail}</div> : null}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-none border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
        <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="px-6 py-6 lg:px-8">{children}</div>
    </Card>
  );
}

export default function DealReview() {
  const { dealId } = useParams<{ dealId: string }>();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const [cancellationReviewNotes, setCancellationReviewNotes] = useState('');
  const [paymentReviewNotes, setPaymentReviewNotes] = useState('');

  const dealQuery = useQuery({
    queryKey: ['admin-deal-review', dealId],
    queryFn: () => adminApi.getDeal(dealId!),
    enabled: Boolean(dealId),
  });

  const deal = dealQuery.data as AdminDealReviewItem | undefined;

  const capTableQuery = useQuery({
    queryKey: ['admin-startup-cap-table', deal?.startup._id],
    queryFn: () => adminApi.getStartupCapTable(deal!.startup._id),
    enabled: Boolean(deal?.startup._id),
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveDealStage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-deal-review', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-startup-cap-table', deal?.startup._id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      adminApi.updateDealReview(dealId!, {
        stockTransferStatus: 'rejected',
        reviewNotes,
      }),
    onSuccess: async () => {
      setReviewNotes('');
      await queryClient.invalidateQueries({ queryKey: ['admin-deal-review', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const cancellationMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      adminApi.reviewDealCancellation(dealId!, {
        decision,
        reviewNotes: cancellationReviewNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      setCancellationReviewNotes('');
      await queryClient.invalidateQueries({ queryKey: ['admin-deal-review', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const paymentApprovalMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      adminApi.reviewPaymentApproval(dealId!, {
        decision,
        reviewNotes: paymentReviewNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      setPaymentReviewNotes('');
      await queryClient.invalidateQueries({ queryKey: ['admin-deal-review', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const metrics = useMemo(() => {
    if (!deal) return null;
    const amount = deal.amountINR ?? deal.stockDetails.transferValueInr ?? 0;
    const fundingNeeded = deal.startup.fundingNeeded ?? 0;
    const equity = deal.equityPercent ?? 0;
    const postMoney = equity > 0 ? amount / (equity / 100) : null;
    return {
      amount,
      coverage: fundingNeeded > 0 ? (amount / fundingNeeded) * 100 : null,
      gap: fundingNeeded > 0 ? Math.max(fundingNeeded - amount, 0) : null,
      postMoney,
      preMoney: postMoney !== null ? Math.max(postMoney - amount, 0) : null,
    };
  }, [deal]);

  const canReviewCancellation = deal?.cancellationRequest?.status === 'pending';
  const canApprove = deal
    ? deal.stage === 3 &&
      deal.adminApprovalRequired &&
      deal.stockTransfer.status !== 'approved' &&
      deal.stockTransfer.status !== 'rejected' &&
      !deal.adminApprovedAt &&
      !canReviewCancellation
    : false;
  const canReject = deal
    ? deal.stage === 3 &&
      deal.adminApprovalRequired &&
      deal.stockTransfer.status !== 'approved' &&
      deal.stockTransfer.status !== 'rejected' &&
      !deal.adminApprovedAt &&
      !canReviewCancellation &&
      reviewNotes.trim().length >= 10
    : false;
  const canRejectCancellation = canReviewCancellation && cancellationReviewNotes.trim().length >= 10;
  const canReviewPaymentApproval = deal?.paymentApproval?.status === 'requested';
  const canRejectPaymentApproval = canReviewPaymentApproval && paymentReviewNotes.trim().length >= 10;

  if (dealQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!deal) {
    return (
      <Card className="p-6">
        <div className="text-sm text-slate-400">Deal not found.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(167,139,250,0.1),transparent_38%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative border-b border-slate-800/80 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.34em] text-cyan-300">Deal Review</span>
              </div>
              <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-white">{deal.startup.name}</h1>
              <p className="mt-3 text-base leading-7 text-slate-300">{deal.startup.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>Stage {deal.stage}</Badge>
                <Badge className={transferTone[deal.stockTransfer.status] ?? transferTone.not_started}>
                  {deal.stockTransfer.status.replace(/_/g, ' ')}
                </Badge>
                <Badge className="border-slate-700 bg-slate-900 text-slate-300">{deal.startup.stage}</Badge>
                <Badge className="border-slate-700 bg-slate-900 text-slate-300">{deal.startup.category}</Badge>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 xl:max-w-sm">
              {deal.startup.pitchDeckUrl ? (
                <a href={deal.startup.pitchDeckUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="w-full justify-center">
                    Open Pitch Deck
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              ) : null}
              <Button
                onClick={() => approveMutation.mutate(deal._id)}
                disabled={!canApprove || approveMutation.isPending || rejectMutation.isPending}
                className="w-full justify-center"
              >
                {canApprove ? 'Approve Transfer' : 'Transfer Already Reviewed'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => rejectMutation.mutate()}
                disabled={!canReject || approveMutation.isPending || rejectMutation.isPending}
                className="w-full justify-center"
              >
                {deal.stockTransfer.status === 'rejected' ? 'Transfer Rejected' : 'Reject Transfer'}
              </Button>
            </div>
          </div>
        </div>

        <div className="relative grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Investor ticket" value={money(deal.amountINR)} detail={`${pct(deal.equityPercent)} equity`} />
          <Stat label="Funding target" value={deal.startup.fundingNeeded ? money(deal.startup.fundingNeeded) : 'Not provided'} detail={`${deal.startup.activeProducts} active products`} />
          <Stat label="Founder score" value={number.format(deal.student.innovationScore)} detail={deal.student.displayName} />
          <Stat label="ProMove royalty" value={money(deal.royalty.promoveAmountINR)} detail={`${deal.royalty.promovePercentage}% mediation fee`} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Section
          eyebrow="Commercial Analytics"
          title="Revenue expectation and financial signals"
          description="Derived from the launch profile and the current deal terms."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Stat label="Coverage of target" value={metrics?.coverage !== null && metrics?.coverage !== undefined ? `${metrics.coverage.toFixed(1)}%` : 'Not enough data'} detail={metrics?.gap ? `${money(metrics.gap)} still open` : 'Raise target covered or not disclosed'} />
            <Stat label="Implied post-money" value={metrics?.postMoney !== null && metrics?.postMoney !== undefined ? money(metrics.postMoney) : 'Pending terms'} detail={metrics?.preMoney !== null && metrics?.preMoney !== undefined ? `Pre-money ${money(metrics.preMoney)}` : 'Requires amount and equity'} />
            <Stat label="Commercial state" value={deal.startup.traction.revenueGenerating ? 'Revenue active' : 'Pre-revenue'} detail={typeof deal.startup.traction.usersCount === 'number' ? `${number.format(deal.startup.traction.usersCount)} users reported` : 'No user count shared'} />
            <Stat label="Launch score" value={number.format(deal.startup.innovationScoreAtLaunch)} detail={`Current snapshot ${number.format(deal.innovationScoreSnapshot)}`} />
            <Stat label="Per-share price" value={money(deal.stockDetails.sharePriceInr)} detail={`${number.format(deal.sharesAllocated ?? 0)} shares allocated`} />
            <Stat label="Transfer value" value={money(deal.stockDetails.transferValueInr)} detail={`${number.format(deal.stockDetails.totalSharesConsidered)} shares considered`} />
          </div>
        </Section>

        <Section
          eyebrow="Workflow"
          title="Review and ownership status"
          description="Admin approval state, transfer metadata, and current cap-table position."
        >
          <div className="space-y-4">
            <div className="border border-slate-800 bg-slate-950 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Next action</div>
              <div className="mt-2 text-lg font-semibold text-white">{deal.nextActionLabel}</div>
              <div className="mt-2 text-sm text-slate-400">Requested {dt(deal.stockTransfer.requestedAt ?? deal.createdAt)}</div>
              <div className="mt-2 text-sm text-slate-400">Admin approval {dt(deal.adminApprovedAt)}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Stat label="Founder retained" value={pct(capTableQuery.data?.founderRetained.equityPercent ?? 0)} detail={`${number.format(capTableQuery.data?.founderRetained.sharesAllocated ?? 0)} shares`} />
              <Stat label="Investor equity" value={pct(capTableQuery.data?.totalInvestorEquity ?? 0)} detail={`${number.format(capTableQuery.data?.availableShares ?? deal.startup.sharePool.availableShares)} shares left`} />
            </div>
            <div className="border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
              Review notes: {deal.stockTransfer.reviewNotes?.trim() || 'No admin notes added yet.'}
            </div>
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              rows={4}
              className="w-full border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              placeholder="Required when rejecting a transfer"
            />
            {deal.paymentApproval && deal.paymentApproval.status !== 'none' ? (
              <div className="border border-amber-500/30 bg-amber-950/10 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300">Payment approval</div>
                    <div className="mt-2 text-lg font-semibold capitalize text-white">
                      {deal.paymentApproval.status}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      Investor is asking for ProMove admin approval in place of the payment gateway.
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Requested {dt(deal.paymentApproval.requestedAt)}
                    </div>
                    {deal.paymentApproval.reviewNotes ? (
                      <div className="mt-3 text-sm text-slate-400">
                        Admin note: {deal.paymentApproval.reviewNotes}
                      </div>
                    ) : null}
                  </div>
                  {canReviewPaymentApproval ? (
                    <div className="flex w-full flex-col gap-3 lg:max-w-xs">
                      <textarea
                        value={paymentReviewNotes}
                        onChange={(event) => setPaymentReviewNotes(event.target.value)}
                        rows={3}
                        className="w-full border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                        placeholder="Required when declining payment approval"
                      />
                      <Button
                        onClick={() => paymentApprovalMutation.mutate('approved')}
                        disabled={paymentApprovalMutation.isPending}
                        className="w-full justify-center"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve Payment
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => paymentApprovalMutation.mutate('rejected')}
                        disabled={!canRejectPaymentApproval || paymentApprovalMutation.isPending}
                        className="w-full justify-center"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline Payment
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {deal.cancellationRequest ? (
              <div className="border border-rose-500/30 bg-rose-950/10 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-rose-300">Cancellation Request</div>
                    <div className="mt-2 text-lg font-semibold capitalize text-white">
                      {deal.cancellationRequest.status}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      {deal.cancellationRequest.reason?.trim() || 'No cancellation reason provided.'}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Requested {dt(deal.cancellationRequest.requestedAt)}
                    </div>
                    {deal.cancellationRequest.reviewNotes ? (
                      <div className="mt-3 text-sm text-slate-400">
                        Admin note: {deal.cancellationRequest.reviewNotes}
                      </div>
                    ) : null}
                  </div>
                  {canReviewCancellation ? (
                    <div className="flex w-full flex-col gap-3 lg:max-w-xs">
                      <textarea
                        value={cancellationReviewNotes}
                        onChange={(event) => setCancellationReviewNotes(event.target.value)}
                        rows={3}
                        className="w-full border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                        placeholder="Required when declining cancellation"
                      />
                      <Button
                        onClick={() => cancellationMutation.mutate('approved')}
                        disabled={cancellationMutation.isPending}
                        className="w-full justify-center"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve Cancellation
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => cancellationMutation.mutate('rejected')}
                        disabled={!canRejectCancellation || cancellationMutation.isPending}
                        className="w-full justify-center"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline Cancellation
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section
          eyebrow="Project Workspace"
          title="Execution progress and evidence"
          description="Milestones, recent updates, repositories, and uploaded diligence material linked to this startup."
        >
          {deal.workspace ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="Workspace" value={deal.workspace.title} detail={`${deal.workspace.category} | ${deal.workspace.stage}`} />
                <Stat label="Progress" value={`${deal.workspace.progressPercent}%`} detail={`${deal.workspace.milestones.filter((item) => item.isCompleted).length}/${deal.workspace.milestones.length} milestones complete`} />
                <Stat label="Evidence items" value={number.format(deal.workspace.evidenceSummary.uploadsCount + deal.workspace.evidenceSummary.repoCount + deal.workspace.evidenceSummary.codeCount)} detail={`${deal.workspace.evidenceSummary.progressUpdatesCount} progress updates`} />
                <Stat label="Updated" value={d(deal.workspace.updatedAt)} detail={`Project id ${deal.startup.projectId ?? 'Not linked'}`} />
              </div>

              <div className="space-y-3">
                {deal.workspace.milestones.map((milestone) => (
                  <div key={milestone._id} className="border border-slate-800 bg-slate-950 px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="font-medium text-white">{milestone.name}</div>
                      <div className="text-sm text-slate-400">{milestone.completionPercent}%</div>
                    </div>
                    <div className="h-2 overflow-hidden bg-slate-900">
                      <div className={`h-full ${milestone.isCompleted ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${milestone.completionPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Recent updates</div>
                  {deal.workspace.progressUpdates.length === 0 ? (
                    <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">No progress updates logged yet.</div>
                  ) : (
                    deal.workspace.progressUpdates.map((update) => (
                      <div key={update._id} className="border border-slate-800 bg-slate-950 px-4 py-4">
                        <div className="text-sm leading-6 text-slate-200">{update.note}</div>
                        <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                          {update.milestoneRef ?? 'General update'} | {dt(update.submittedAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Repositories</div>
                  {deal.workspace.repoSubmissions.length === 0 ? (
                    <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">No repository links attached.</div>
                  ) : (
                    deal.workspace.repoSubmissions.map((repo) => (
                      <a key={repo._id} href={repo.repoUrl} target="_blank" rel="noreferrer" className="block border border-slate-800 bg-slate-950 px-4 py-4 transition-colors hover:border-slate-700">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <GitBranch className="h-4 w-4 text-cyan-300" />
                              {repo.displayName}
                            </div>
                            <div className="mt-2 text-sm text-slate-400">
                              {repo.branch ? `Branch ${repo.branch}` : 'Branch not provided'}
                              {repo.commitHash ? ` | Commit ${repo.commitHash}` : ''}
                            </div>
                            {repo.note ? <div className="mt-2 text-sm text-slate-300">{repo.note}</div> : null}
                          </div>
                          <ExternalLink className="mt-1 h-4 w-4 text-slate-500" />
                        </div>
                      </a>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">
              This startup is not linked to a workspace record yet.
            </div>
          )}
        </Section>

        <Section
          eyebrow="Documents"
          title="Pitch deck and uploaded artifacts"
          description="Primary launch document plus recent files available for diligence."
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Pitch deck</div>
                    <div className="mt-2 text-lg font-semibold text-white">{deal.startup.pitchDeckName ?? 'Startup pitch deck'}</div>
                    <div className="mt-2 text-sm text-slate-400">{deal.startup.pitchDeckUrl ? 'Deck uploaded and available.' : 'No pitch deck uploaded.'}</div>
                  </div>
                  <FileText className="h-5 w-5 text-cyan-300" />
                </div>
                {deal.startup.pitchDeckUrl ? (
                  <a href={deal.startup.pitchDeckUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex">
                    <Button variant="secondary">
                      Open deck
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                ) : null}
              </div>

              <div className="border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Evidence snapshot</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-400"><span>Uploads</span><span className="font-semibold text-white">{number.format(deal.workspace?.evidenceSummary.uploadsCount ?? 0)}</span></div>
                  <div className="flex items-center justify-between text-slate-400"><span>Repositories</span><span className="font-semibold text-white">{number.format(deal.workspace?.evidenceSummary.repoCount ?? 0)}</span></div>
                  <div className="flex items-center justify-between text-slate-400"><span>Code snippets</span><span className="font-semibold text-white">{number.format(deal.workspace?.evidenceSummary.codeCount ?? 0)}</span></div>
                  <div className="flex items-center justify-between text-slate-400"><span>Progress updates</span><span className="font-semibold text-white">{number.format(deal.workspace?.evidenceSummary.progressUpdatesCount ?? 0)}</span></div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Recent uploaded files</div>
              {deal.workspace?.uploads.length ? (
                deal.workspace.uploads.map((upload) => (
                  <a key={upload._id} href={upload.fileUrl} target="_blank" rel="noreferrer" className="block border border-slate-800 bg-slate-950 px-4 py-4 transition-colors hover:border-slate-700">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{upload.fileName}</div>
                        <div className="mt-2 text-sm text-slate-400">
                          {(upload.category ?? 'other').replace(/_/g, ' ')} | {upload.fileType.toUpperCase()} | {number.format(upload.fileSizeBytes)} bytes
                        </div>
                        {upload.note ? <div className="mt-2 text-sm text-slate-300">{upload.note}</div> : null}
                        <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Uploaded {dt(upload.uploadedAt)}</div>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 text-slate-500" />
                    </div>
                  </a>
                ))
              ) : (
                <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">No uploaded files linked yet.</div>
              )}
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section
          eyebrow="Founder Detail"
          title="Profiles and execution signals"
          description="Founders, score breakdowns, and traction indicators tied to the launch profile."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={deal.startup.traction.mvpBuilt ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}>MVP {deal.startup.traction.mvpBuilt ? 'built' : 'pending'}</Badge>
              <Badge className={deal.startup.traction.patentFiled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}>Patent {deal.startup.traction.patentFiled ? 'filed' : 'not filed'}</Badge>
              <Badge className={deal.startup.traction.revenueGenerating ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}>{deal.startup.traction.revenueGenerating ? 'Revenue generating' : 'Pre-revenue'}</Badge>
            </div>
            {deal.startup.founders.length === 0 ? (
              <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">No founder profiles attached yet.</div>
            ) : (
              deal.startup.founders.map((founder) => (
                <div key={founder._id} className="border border-slate-800 bg-slate-950 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">{founder.displayName}</div>
                      <div className="mt-1 text-sm text-slate-400">{founder.domain ?? 'Founder'} | Score {number.format(founder.innovationScore)}</div>
                    </div>
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">Founder</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(founder.scoreBreakdown).length === 0 ? (
                      <div className="text-sm text-slate-500">No score breakdown submitted.</div>
                    ) : (
                      Object.entries(founder.scoreBreakdown).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-3 text-sm">
                          <span className="text-slate-400">{breakdownLabels[key] ?? key}</span>
                          <span className="font-semibold text-white">{number.format(value)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section
          eyebrow="Score Timeline"
          title="Recent founder momentum"
          description="Latest score events from the lead founder profile."
        >
          {deal.scoreEvents.length === 0 ? (
            <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">No score events available yet.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {deal.scoreEvents.map((event) => (
                <div key={event._id} className="border border-slate-800 bg-slate-950 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{trigger(event.trigger)}</div>
                      <div className="mt-2 text-sm text-slate-400">{dt(event.createdAt)}</div>
                    </div>
                    <div className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-300">
                      <TrendingUp className="h-4 w-4" />+{number.format(event.delta)}
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-300">Score after event: {number.format(event.scoreAfter)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
