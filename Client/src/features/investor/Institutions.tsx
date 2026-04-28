import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, MapPin, RefreshCw, Search, Star, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { investorApi } from '../../api/investor.api';
import { InvestorWorkspaceLayout } from './InvestorWorkspaceLayout';

const types = ['school', 'college'] as const;

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value);

export default function Institutions() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<(typeof types)[number]>('school');
  const [search, setSearch] = useState('');
  const selectedTypeLabel = selectedType === 'school' ? 'Schools' : 'Colleges';

  const institutionsQuery = useQuery({
    queryKey: ['investor-institutions', selectedType],
    queryFn: () => investorApi.getInstitutions(selectedType),
  });

  const allInstitutions = institutionsQuery.data ?? [];
  const institutions = useMemo(
    () =>
      allInstitutions.filter((institution) =>
        `${institution.institutionName} ${institution.location}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [allInstitutions, search],
  );

  const summary = useMemo(
    () => {
      const totalStudents = institutions.reduce(
        (total, institution) => total + institution.totalStudentsEnrolled,
        0,
      );
      const averageRating =
        institutions.length > 0
          ? institutions.reduce((total, institution) => total + institution.iicStarRating, 0) /
            institutions.length
          : 0;

      return {
        visibleCount: institutions.length,
        totalCount: allInstitutions.length,
        totalStudents,
        averageRating,
      };
    },
    [allInstitutions.length, institutions],
  );

  return (
    <InvestorWorkspaceLayout
      title="Institutions"
      description="Browse schools and colleges seeking investor collaboration."
      headerAction={
        <div className="relative w-full lg:w-72 xl:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search institutions"
            className="h-12 rounded-xl border-slate-800 bg-slate-950/80 pl-11"
          />
        </div>
      }
      contentClassName="mx-auto w-full max-w-[1480px] space-y-6"
    >
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-2xl border border-slate-800 bg-slate-950 p-1">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                selectedType === type
                  ? 'bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {type === 'school' ? 'Schools' : 'Colleges'}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{summary.visibleCount}</span> of{' '}
          <span className="font-semibold text-white">{summary.totalCount}</span> {selectedTypeLabel.toLowerCase()}
        </div>
      </section>

      {institutionsQuery.isLoading ? (
        <Card className="p-8">
          <div className="space-y-4">
            <div className="h-4 w-44 rounded-full bg-slate-800" />
            <div className="h-20 rounded-2xl bg-slate-950" />
            <div className="h-20 rounded-2xl bg-slate-950" />
          </div>
        </Card>
      ) : institutionsQuery.isError ? (
        <Card className="flex flex-col gap-4 p-8">
          <div className="text-lg font-semibold text-white">Unable to load institutions</div>
          <p className="text-sm text-slate-400">
            The investor institution directory could not be loaded right now.
          </p>
          <button
            type="button"
            onClick={() => void institutionsQuery.refetch()}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{summary.visibleCount}</div>
                  <div className="text-sm text-slate-400">Visible {selectedTypeLabel.toLowerCase()}</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{formatNumber(summary.totalStudents)}</div>
                  <div className="text-sm text-slate-400">Students represented</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{summary.averageRating.toFixed(1)}</div>
                  <div className="text-sm text-slate-400">Average IIC rating</div>
                </div>
              </div>
            </Card>
          </div>

          {institutions.length > 0 ? (
            <div className="space-y-3">
              {institutions.map((institution) => (
                <Card
                  key={institution._id}
                  className="group overflow-hidden p-0 transition hover:border-cyan-500/30 hover:bg-slate-900/80"
                >
                  <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xl font-semibold text-white">{institution.institutionName}</div>
                        <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                          {institution.academicYear}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-cyan-300">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{institution.location}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge>{institution.focusLabel}</Badge>
                        <Badge className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                          {institution.institutionType === 'school' ? 'School partner' : 'College partner'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-right">
                        <div className="text-2xl font-bold text-white">
                          {formatNumber(institution.totalStudentsEnrolled)}
                        </div>
                        <div className="text-xs text-slate-400">Students</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-right">
                        <div className="text-2xl font-bold text-white">{institution.iicStarRating.toFixed(1)}</div>
                        <div className="text-xs text-slate-400">IIC Rating</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-white">No connected institutions</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {search
                      ? `No ${selectedTypeLabel.toLowerCase()} match "${search}". Clear the search or switch institution type to keep exploring.`
                      : `No ${selectedTypeLabel.toLowerCase()} are available in your investor institution feed yet.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                    >
                      Clear search
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/investor/startups')}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Browse startup marketplace
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </InvestorWorkspaceLayout>
  );
}

