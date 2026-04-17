import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  FileText,
  MessageSquareWarning,
  PenLine,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import { patentApi } from '../../api/patent.api';
import { startupApi } from '../../api/startup.api';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { PatentSubmission } from '../../types/patent.types';
import type { Startup, StartupReviewStatus } from '../../types/startup.types';
import {
  getStartupSectionPath,
  getStartupOverviewPath,
  STARTUP_LAUNCH_NEW_PATH,
} from './navigation';
import type { LucideIcon } from 'lucide-react';

const reviewBadge: Record<StartupReviewStatus, { label: string; className: string; Icon: LucideIcon }> = {
  draft: { label: 'Draft', className: 'border-slate-700 bg-slate-900 text-slate-300', Icon: PenLine },
  review_requested: { label: 'Under Review', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200', Icon: Clock },
  changes_requested: { label: 'Changes Requested', className: 'border-rose-500/30 bg-rose-500/10 text-rose-200', Icon: MessageSquareWarning },
  approved: { label: 'Approved', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle },
};

const PATENT_STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-rose-500/10 text-rose-300',
  under_review: 'bg-cyan-500/10 text-cyan-300',
  submitted: 'bg-amber-500/10 text-amber-300',
};

function StartupCard({ startup }: { startup: Startup }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const badge = reviewBadge[startup.reviewStatus] ?? reviewBadge.draft;
  const BadgeIcon = badge.Icon;
  const isLive = startup.launchedToInvestors || startup.launchedToMentors;
  const isVerifiedAndLive = startup.reviewStatus === 'approved' && isLive;
  const canDelete = !isVerifiedAndLive;
  const nameMatches = confirmName.trim().toLowerCase() === (startup.name || '').trim().toLowerCase();

  const deleteMutation = useMutation({
    mutationFn: () => startupApi.delete(startup._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['startup', 'mine'] });
      setShowConfirm(false);
      setConfirmName('');
    },
  });

  const openConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmName('');
    deleteMutation.reset();
    setShowConfirm(true);
  };

  const closeConfirm = () => {
    setShowConfirm(false);
    setConfirmName('');
  };

  return (
    <>
      <Card
        className="cursor-pointer p-5 transition hover:border-cyan-500/30"
        onClick={() => navigate(getStartupOverviewPath(startup._id))}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-lg font-bold text-white">
              {startup.name ? startup.name.slice(0, 1).toUpperCase() : <Rocket className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {startup.name || 'Untitled Startup'}
              </h3>
              {startup.tagline ? (
                <p className="mt-1 text-sm text-slate-400">{startup.tagline}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {startup.category ? (
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                    {startup.category}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                  {startup.stage}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Eye className="h-3 w-3" />
                Live on Marketplace
              </span>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                title="Delete startup"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                onClick={openConfirm}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800 pt-4 text-center text-sm">
          <div>
            <div className="font-semibold text-white">{startup.teamSize}</div>
            <div className="text-xs text-slate-500">Team</div>
          </div>
          <div>
            <div className="font-semibold text-white">{startup.activeProducts}</div>
            <div className="text-xs text-slate-500">Products</div>
          </div>
          <div>
            <div className="font-semibold text-white">
              {startup.fundingNeeded ? `${(startup.fundingNeeded / 100_000).toFixed(1)}L` : '--'}
            </div>
            <div className="text-xs text-slate-500">Funding</div>
          </div>
        </div>
      </Card>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeConfirm}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Startup</h3>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              This will permanently delete <span className="font-medium text-white">{startup.name || 'this startup'}</span> and all associated documents, pitch decks, and data. This action cannot be undone.
            </p>
            <div className="mt-4">
              <label className="block text-sm text-slate-400">
                Type <span className="font-mono font-medium text-white">{startup.name || 'startup name'}</span> to confirm
              </label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
                placeholder={startup.name || 'startup name'}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoFocus
              />
            </div>
            {deleteMutation.isError ? (
              <p className="mt-3 text-sm text-red-400">
                {(deleteMutation.error as any)?.response?.data?.message ?? 'Failed to delete startup. Please try again.'}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                onClick={closeConfirm}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => deleteMutation.mutate()}
                disabled={!nameMatches || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Startup'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StartupPatentSubmissions({ startups }: { startups: Startup[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showcaseError, setShowcaseError] = useState('');

  const patentsQuery = useQuery({
    queryKey: ['patents', 'mine'],
    queryFn: patentApi.mine,
    enabled: startups.length > 0,
  });

  const startupByWorkspaceId = new Map(
    startups
      .filter((startup): startup is Startup & { projectId: string } => Boolean(startup.projectId))
      .map((startup) => [startup.projectId, startup]),
  );

  const patents = patentsQuery.data ?? [];
  const visiblePatents = patents
    .filter((patent) => patent.workspaceId && startupByWorkspaceId.has(patent.workspaceId))
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());

  const showcaseMutation = useMutation({
    mutationFn: (patentId: string) => patentApi.toggleShowcase(patentId),
    onSuccess: async () => {
      setShowcaseError('');
      await queryClient.invalidateQueries({ queryKey: ['patents', 'mine'] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Unable to update showcase status.';
      setShowcaseError(message);
    },
  });

  return (
    <section className="border-t border-slate-800 pt-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Existing submissions</h2>
          <p className="mt-2 text-sm text-slate-400">
            Patent and IPR submissions linked to your startup workspaces.
          </p>
        </div>

        {patentsQuery.isLoading ? (
          <Card className="p-8">
            <div className="flex items-center justify-center">
              <Spinner />
            </div>
          </Card>
        ) : patentsQuery.isError ? (
          <Card className="p-6 text-sm text-red-200">
            Unable to load your startup submissions right now.
          </Card>
        ) : visiblePatents.length === 0 ? (
          <Card className="border-dashed p-8">
            <div className="flex flex-col items-center justify-center text-center text-slate-400">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <div className="text-sm">No patent submissions linked to your startups yet.</div>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-slate-800">
              {showcaseError ? (
                <div className="mx-5 mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {showcaseError}
                </div>
              ) : null}

              {visiblePatents.map((patent) => {
                const startup = patent.workspaceId ? startupByWorkspaceId.get(patent.workspaceId) : undefined;
                const documents = patent.supportingDocuments ?? [];
                const viewPath = startup
                  ? getStartupSectionPath(startup._id, 'patent-support')
                  : patent.workspaceId
                    ? `/patent-support/${patent.workspaceId}`
                    : '/patent-support';

                return (
                  <div
                    key={patent._id}
                    className="flex flex-col justify-between gap-4 px-5 py-5 md:flex-row md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-lg font-semibold text-white">
                          {patent.projectTitle}
                        </span>
                        {patent.showcasedInMarketplace ? (
                          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                            Showcased
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        Submitted {new Date(patent.submittedAt).toLocaleDateString('en-IN')}
                        {startup?.name ? ` • ${startup.name}` : ''}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {documents.length} document{documents.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          PATENT_STATUS_STYLES[patent.status] ?? PATENT_STATUS_STYLES.submitted
                        }`}
                      >
                        {patent.status.replace(/_/g, ' ')}
                      </span>

                      {patent.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => showcaseMutation.mutate(patent._id)}
                          disabled={showcaseMutation.isPending}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            patent.showcasedInMarketplace
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                              : 'border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300'
                          }`}
                        >
                          {patent.showcasedInMarketplace ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          {patent.showcasedInMarketplace ? 'Unshowcase' : 'Showcase'}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => navigate(viewPath)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

export function MyStartups() {
  const startupQuery = useQuery({
    queryKey: ['startup', 'mine'],
    queryFn: startupApi.mine,
  });

  const startups = startupQuery.data ?? [];

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-white">Startup</h1>
          <Link
            to={STARTUP_LAUNCH_NEW_PATH}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
          >
            <Plus className="h-5 w-5" />
            New Startup
          </Link>
        </div>

        {startupQuery.isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner />
          </div>
        ) : startupQuery.isError ? (
          <Card className="p-8 text-sm text-red-200">
            Unable to load your startups right now.
          </Card>
        ) : startups.length === 0 ? (
          <Card className="p-10 text-center">
            <Rocket className="mx-auto h-12 w-12 text-slate-600" />
            <h2 className="mt-4 text-xl font-bold text-white">No startups yet</h2>
            <Link
              to={STARTUP_LAUNCH_NEW_PATH}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
            >
              <Plus className="h-5 w-5" />
              Create Startup
            </Link>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {startups.map((startup) => (
                <StartupCard key={startup._id} startup={startup} />
              ))}
            </div>

            <StartupPatentSubmissions startups={startups} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
