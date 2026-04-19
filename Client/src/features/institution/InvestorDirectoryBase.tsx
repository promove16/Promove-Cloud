import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, MapPin, Search, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { DirectoryInvestor } from '../../types/school.types';
import { getUserPortfolioViewPath } from '../marketplace/navigation';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  queryKey: string;
  fetchInvestors: () => Promise<DirectoryInvestor[]>;
};

export function InvestorDirectoryBase({
  mode,
  title,
  subtitle,
  queryKey,
  fetchInvestors,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const investorsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchInvestors,
  });

  const investors = useMemo(
    () =>
      (investorsQuery.data ?? []).filter((investor) =>
        `${investor.displayName} ${investor.domain ?? ''} ${investor.headline ?? ''} ${
          investor.location ?? ''
        } ${investor.bio ?? ''} ${(investor.focusAreas ?? []).join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [investorsQuery.data, search],
  );

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow="Student Workspace"
        title={title}
        description={subtitle}
        tabsAction={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by investor, focus area, or location"
              className="pl-11"
            />
          </div>
        }
      />

      {investors.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {investors.map((investor) => (
            <Card key={investor._id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl font-bold text-white">
                    {investor.avatar ? (
                      <img
                        src={investor.avatar}
                        alt={investor.displayName}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      investor.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                        Investor
                      </span>
                      {investor.domain ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                          {investor.domain}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 text-xl font-semibold text-white">{investor.displayName}</div>
                    <div className="mt-1 text-sm text-slate-300">
                      {investor.headline ?? 'Public investor profile'}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                      {investor.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-cyan-500" />
                          {investor.location}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        {investor.contactPreference}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      {investor.bio ??
                        'Review the investor profile before reaching out to check fit, focus, and public proof.'}
                    </p>

                    {(investor.focusAreas ?? []).length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(investor.focusAreas ?? []).map((focusArea) => (
                          <span
                            key={`${investor._id}-${focusArea}`}
                            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300"
                          >
                            {focusArea}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-3 py-2">
                        <BriefcaseBusiness className="h-4 w-4 text-cyan-400" />
                        {investor.experienceCount} experience entries
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        {investor.profileProofCount} public proofs
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => navigate(getUserPortfolioViewPath('investor', investor._id))}
                >
                  {(investor.focusAreas ?? []).length > 0 ? 'View thesis' : 'View profile'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="max-w-2xl">
            <div className="text-lg font-semibold text-white">No investor matches found</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Try another keyword or clear the current search to review investors by focus area, proof, and public profile quality.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
