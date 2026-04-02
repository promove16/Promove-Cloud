import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  Clock,
  Eye,
  MessageSquareWarning,
  PenLine,
  Plus,
  Rocket,
} from 'lucide-react';
import { startupApi } from '../../api/startup.api';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { Startup, StartupReviewStatus } from '../../types/startup.types';
import {
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

function StartupCard({ startup }: { startup: Startup }) {
  const navigate = useNavigate();
  const badge = reviewBadge[startup.reviewStatus];
  const BadgeIcon = badge.Icon;
  const isLive = startup.launchedToInvestors || startup.launchedToMentors;

  return (
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
  );
}

export function MyStartups() {
  const navigate = useNavigate();
  const startupQuery = useQuery({
    queryKey: ['startup', 'mine'],
    queryFn: startupApi.mine,
  });

  const startups = startupQuery.data ?? [];

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Startups</h1>
            <p className="mt-2 text-slate-400">
              Create and manage your startups. Each startup goes through admin review before listing on the marketplace.
            </p>
          </div>
          <button
            onClick={() => navigate(STARTUP_LAUNCH_NEW_PATH)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
          >
            <Plus className="h-5 w-5" />
            New Startup
          </button>
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
            <p className="mt-2 text-sm text-slate-400">
              Create your first startup to get it reviewed by admin and listed on the investor marketplace.
            </p>
            <button
              onClick={() => navigate(STARTUP_LAUNCH_NEW_PATH)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
            >
              <Plus className="h-5 w-5" />
              Create Startup
            </button>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {startups.map((startup) => (
              <StartupCard key={startup._id} startup={startup} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
