import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Landmark,
  type LucideIcon,
  PieChart,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { adminApi, type AdminDealReviewItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { CapTableInvestorRow } from '../../types/deal.types';
import { MAX_INNOVATION_SCORE } from '../../constants/score';

const formatCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatNumber = new Intl.NumberFormat('en-IN');

const stageLabels: Record<1 | 2 | 3 | 4, string> = {
  1: 'Due Diligence',
  2: 'Fund Transfer',
  3: 'Equity Transfer',
  4: 'Portfolio',
};

const roleLabel = (value?: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Pending');

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to load this transaction.';
  }

  return error instanceof Error ? error.message : 'Unable to load this transaction.';
};

function MetricTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          tone === 'success' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function PartyPanel({
  title,
  subtitle,
  name,
  score,
  role,
}: {
  title: string;
  subtitle: string;
  name: string;
  score: number;
  role: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</div>
      <div className="mt-3 text-xl font-semibold text-white">{name}</div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge>{roleLabel(role)}</Badge>
        <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{score}/{MAX_INNOVATION_SCORE} score</Badge>
      </div>
    </div>
  );
}

function CapTableRow({
  row,
  isActive,
}: {
  row: CapTableInvestorRow;
  isActive: boolean;
}) {
  return (
    <div
      className={`grid gap-3 rounded-3xl border p-4 md:grid-cols-[1.5fr,0.8fr,0.8fr,0.9fr] ${
        isActive
          ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Investor</div>
        <div className="mt-2 font-semibold text-white">{row.name ?? 'Restricted'}</div>
        <div className="mt-1 text-sm text-slate-400">{roleLabel(row.investorRole)}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
        <div className="mt-2 font-semibold text-white">{row.equityPercent}%</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Shares</div>
        <div className="mt-2 font-semibold text-white">{formatNumber.format(row.sharesAllocated)}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Voting</div>
        <div className="mt-2 font-semibold text-white">{row.votingWeight}%</div>
      </div>
    </div>
  );
}

function ReviewChecklist({ deal }: { deal: AdminDealReviewItem }) {
  const checks = [
    {
      label: 'Fund transfer initiated',
      value: deal.fundTransferInitiatedAt ? formatDateTime(deal.fundTransferInitiatedAt) : 'Waiting for stage 2 transfer log',
      complete: Boolean(deal.fundTransferInitiatedAt),
    },
    {
      label: 'Equity transfer staged',
      value: deal.stage >= 3 ? `Stage ${deal.stage} - ${stageLabels[deal.stage]}` : 'Transaction has not reached review stage',
      complete: deal.stage >= 3,
    },
    {
      label: 'Authority terms resolved',
      value: `${roleLabel(deal.investorRole)} with ${deal.votingWeight ?? 0}% voting weight`,
      complete: typeof deal.votingWeight === 'number' && typeof deal.investorRole === 'string',
    },
    {
      label: 'Admin verification',
      value: deal.adminApprovedAt ? formatDateTime(deal.adminApprovedAt) : 'Pending admin approval',
      complete: Boolean(deal.adminApprovedAt),
    },
  ];

  return (
    <div className="space-y-3">
      {checks.map((item) => (
        <div
          key={item.label}
          className={`rounded-3xl border px-4 py-4 ${
            item.complete ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
                item.complete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="mt-1 text-sm text-slate-400">{item.value}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DealReview() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dealQuery = useQuery({
    queryKey: ['admin-deal', dealId],
    queryFn: () => adminApi.getDeal(dealId!),
    enabled: Boolean(dealId),
  });

  const capTableQuery = useQuery({
    queryKey: ['admin-cap-table', dealQuery.data?.startupId],
    queryFn: () => adminApi.getStartupCapTable(dealQuery.data!.startupId),
    enabled: Boolean(dealQuery.data?.startupId),
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveDealStage,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-deals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-deal', dealId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-cap-table', dealQuery.data?.startupId] }),
      ]);
    },
  });

  if (!dealId) {
    return <Navigate to="/dashboard/admin/deals" replace />;
  }

  if (dealQuery.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (dealQuery.isError || !dealQuery.data) {
    return (
      <Card className="max-w-3xl space-y-4 p-8">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deals</div>
        <h1 className="text-3xl font-bold text-white">Transaction review unavailable</h1>
        <p className="text-slate-400">{getErrorMessage(dealQuery.error)}</p>
        <div>
          <Button variant="secondary" onClick={() => navigate('/dashboard/admin/deals')}>
            Back to approvals
          </Button>
        </div>
      </Card>
    );
  }

  const deal = dealQuery.data;
  const capTable = capTableQuery.data;
  const capTableRows = [
    ...(capTable?.soleInvestor ? [capTable.soleInvestor] : []),
    ...(capTable?.pennyInvestors ?? []),
  ];
  const activeDealRow = capTableRows.find((row) => row.dealId === deal._id);
  const canApprove = deal.adminApprovalRequired && deal.stage === 3 && !deal.adminApprovedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/deals')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to approvals
          </button>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Transaction Review</div>
            <h1 className="mt-2 text-3xl font-bold text-white">{deal.startup.name}</h1>
            <p className="mt-2 max-w-3xl text-slate-400">
              Review the staged equity transfer, confirm authority terms, and approve the transaction once the
              funding and cap-table context look correct.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Stage {deal.stage}</Badge>
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{stageLabels[deal.stage]}</Badge>
            {deal.investorType ? (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">{deal.investorType.toUpperCase()}</Badge>
            ) : null}
            <Badge>{roleLabel(deal.investorRole)}</Badge>
            {deal.canVeto ? <Badge className="border-red-500/30 bg-red-500/10 text-red-300">Veto Enabled</Badge> : null}
            {deal.adminApprovedAt ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Approved</Badge>
            ) : (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Pending Admin Review</Badge>
            )}
          </div>
        </div>

        <div className="flex w-full max-w-xl flex-col gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 xl:items-end">
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Transaction ID</div>
            <div className="mt-2 font-mono text-sm text-slate-300">{deal._id}</div>
          </div>
          {approveMutation.isError ? (
            <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {getErrorMessage(approveMutation.error)}
            </div>
          ) : null}
          {approveMutation.isSuccess ? (
            <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Equity transfer approved. The investor can now move the deal forward.
            </div>
          ) : null}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate('/dashboard/admin/deals')}>
              Return to queue
            </Button>
            <Button onClick={() => approveMutation.mutate(deal._id)} disabled={!canApprove || approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : canApprove ? 'Approve Equity Transfer' : 'Approval Complete'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={Wallet}
          label="Investment Amount"
          value={formatCurrency.format(deal.amountINR ?? 0)}
        />
        <MetricTile
          icon={PieChart}
          label="Equity Requested"
          value={`${deal.equityPercent ?? 0}%`}
        />
        <MetricTile
          icon={Landmark}
          label="Allocated Shares"
          value={formatNumber.format(deal.sharesAllocated ?? 0)}
        />
        <MetricTile
          icon={deal.adminApprovedAt ? CheckCircle2 : ShieldCheck}
          label="Admin Status"
          value={deal.adminApprovedAt ? 'Verified' : 'Pending'}
          tone={deal.adminApprovedAt ? 'success' : 'default'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Terms Snapshot</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Commercial and authority terms</h2>
            </div>
            <Badge className="border-slate-700 bg-slate-900 text-slate-300">{deal.status}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Next action</div>
              <div className="mt-2 text-lg font-semibold text-white">{deal.nextActionLabel}</div>
              <div className="mt-2 text-sm text-slate-400">
                {deal.adminApprovalRequired
                  ? 'The transaction is blocked until admin review is completed.'
                  : 'This transaction has cleared the admin gate for the current stage.'}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Authority profile</div>
              <div className="mt-2 text-lg font-semibold text-white">{roleLabel(deal.investorRole)}</div>
              <div className="mt-2 text-sm text-slate-400">
                Voting weight {deal.votingWeight ?? 0}%{deal.canVeto ? ' with veto rights.' : '.'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PartyPanel
              title="Startup"
              subtitle={`${deal.startup.category} - ${deal.startup.stage}`}
              name={deal.startup.name}
              score={deal.innovationScoreSnapshot}
              role="startup snapshot"
            />
            <PartyPanel
              title="Founder"
              subtitle="Student account attached to the transaction"
              name={deal.student.displayName}
              score={deal.student.innovationScore}
              role={deal.student.role}
            />
            <PartyPanel
              title="Investor"
              subtitle="Investor account requesting the transfer"
              name={deal.investor.displayName}
              score={deal.investor.innovationScore}
              role={deal.investor.role}
            />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Startup context</div>
                <div className="mt-2 text-lg font-semibold text-white">{deal.startup.tagline}</div>
                <div className="mt-3 text-sm leading-6 text-slate-400">
                  This approval should be reviewed against the startup's current stage, requested authority, and cap-table
                  availability before releasing the transaction.
                </div>
              </div>
              {deal.startup.pitchDeckUrl ? (
                <a
                  href={deal.startup.pitchDeckUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500/40"
                >
                  Open Pitch Deck
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Review Checklist</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Approval readiness</h2>
            <p className="mt-2 text-sm text-slate-400">
              Verify the stage progression and authority terms before releasing the transaction.
            </p>
          </div>
          <ReviewChecklist deal={deal} />
        </Card>
      </div>

      <Card className="space-y-5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Cap Table</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Current ownership impact</h2>
            <p className="mt-2 text-sm text-slate-400">
              The highlighted row shows where this transaction sits in the startup's current ownership structure.
            </p>
          </div>
          {activeDealRow ? (
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Transaction located in cap table</Badge>
          ) : (
            <Badge className="border-slate-700 bg-slate-900 text-slate-300">Row not available yet</Badge>
          )}
        </div>

        {capTableQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : capTable ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricTile icon={Landmark} label="Total Shares" value={formatNumber.format(capTable.totalShares)} />
              <MetricTile icon={Landmark} label="Available Shares" value={formatNumber.format(capTable.availableShares)} />
              <MetricTile icon={PieChart} label="Investor Equity" value={`${capTable.totalInvestorEquity}%`} />
              <MetricTile icon={FileCheck} label="Founder Retained" value={`${capTable.founderRetained.equityPercent}%`} />
            </div>

            <div className="space-y-3">
              {capTableRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-800 px-5 py-8 text-sm text-slate-400">
                  No investor rows exist for this startup yet.
                </div>
              ) : (
                capTableRows.map((row) => (
                  <CapTableRow key={row.dealId} row={row} isActive={row.dealId === deal._id} />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-800 px-5 py-8 text-sm text-slate-400">
            Cap table data could not be loaded for this startup.
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Timeline</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Transaction history</h2>
        </div>
        {[
          ['Created', formatDateTime(deal.createdAt)],
          ['Fund transfer initiated', formatDateTime(deal.fundTransferInitiatedAt)],
          ['Last updated', formatDateTime(deal.updatedAt)],
          ['Admin approved', formatDateTime(deal.adminApprovedAt)],
          ['Closed', formatDateTime(deal.closedAt)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-3xl border border-slate-800 bg-slate-900/60 px-5 py-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-sm text-slate-400">{value}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
