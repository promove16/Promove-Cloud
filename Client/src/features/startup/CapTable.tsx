import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { startupApi } from '../../api/startup.api';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { normalizeStartupRouteId } from './navigation';
import { isStartupFounder } from './startupAccess';

const formatRoleLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function StartupCapTable() {
  const { startupId } = useParams<{ startupId: string }>();
  const normalizedStartupId = normalizeStartupRouteId(startupId);
  const currentUserId = useAuthStore((state) => state.user?._id);

  const startupQuery = useQuery({
    queryKey: ['startup', normalizedStartupId],
    queryFn: () => startupApi.getById(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId),
  });

  const startup = startupQuery.data;
  const isFounder = isStartupFounder(startup, currentUserId);

  const capTableQuery = useQuery({
    queryKey: ['startup', 'cap-table', normalizedStartupId],
    queryFn: () => startupApi.getCapTable(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId && startup && isFounder),
  });

  if (startupQuery.isLoading || (isFounder && capTableQuery.isLoading)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (startupQuery.isError || (isFounder && capTableQuery.isError)) {
    return (
      <Card className="max-w-3xl p-8 text-sm text-red-200">
        {getApiErrorMessage(
          startupQuery.error ?? capTableQuery.error,
          'Unable to load the cap table right now.',
        )}
      </Card>
    );
  }

  if (!startup) {
    return (
      <Card className="max-w-3xl p-8">
        <h1 className="text-3xl font-bold text-white">Cap Table</h1>
        <p className="mt-3 text-slate-400">
          Create your startup first to begin tracking investors and shares.
        </p>
      </Card>
    );
  }

  if (!isFounder) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Cap Table</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Cap table records are founder-managed because they define ownership,
            investor rights, and share allocation for the company.
          </p>
        </div>
        <Card className="max-w-3xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
            Founder-managed area
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">
            Ask a founder to manage this startup's cap table.
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-100/90">
            You can stay involved in the startup workspace, but equity
            allocation and investor ownership records should be handled by the
            startup creator or current founders.
          </p>
        </Card>
      </div>
    );
  }

  const capTable = capTableQuery.data;
  const pennyRows = capTable?.pennyInvestors ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Cap Table</h1>
        <p className="mt-2 text-slate-400">
          Founder-managed record for sole investors, penny investors, retained
          equity, and share allocation.
        </p>
      </div>

      {capTable ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Total Shares
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {capTable.totalShares}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Available Shares
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {capTable.availableShares}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Investor Equity
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {capTable.totalInvestorEquity}%
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Founder Retained
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {capTable.founderRetained.equityPercent}%
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Sole Investor
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Primary owner or lead investor allocation.
                </div>
              </div>
              {capTable.soleInvestor ? (
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                  SOLE
                </Badge>
              ) : (
                <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                  Open Slot
                </Badge>
              )}
            </div>
            {capTable.soleInvestor ? (
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:col-span-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Investor
                  </div>
                  <div className="mt-2 font-semibold text-white">
                    {capTable.soleInvestor.name ?? 'Restricted'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Equity
                  </div>
                  <div className="mt-2 font-semibold text-white">
                    {capTable.soleInvestor.equityPercent}%
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Shares
                  </div>
                  <div className="mt-2 font-semibold text-white">
                    {capTable.soleInvestor.sharesAllocated}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Authority
                  </div>
                  <div className="mt-2 font-semibold text-white">
                    {formatRoleLabel(capTable.soleInvestor.investorRole)}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Penny Investors
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Crowd-style investors with minority authority and capped
                  equity.
                </div>
              </div>
              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                {pennyRows.length} investors
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {pennyRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                  No penny investors yet.
                </div>
              ) : (
                pennyRows.map((row) => (
                  <div
                    key={row.dealId}
                    className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-5"
                  >
                    <div className="md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Investor
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {row.name ?? 'Restricted'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Equity
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {row.equityPercent}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Shares
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {row.sharesAllocated}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Role
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {formatRoleLabel(row.investorRole)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
