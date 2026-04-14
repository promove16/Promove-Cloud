import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { investorApi } from '../../api/investor.api';

const types = ['school', 'college'] as const;

export default function Institutions() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<(typeof types)[number]>('school');
  const [search, setSearch] = useState('');

  const institutionsQuery = useQuery({
    queryKey: ['investor-institutions', selectedType],
    queryFn: () => investorApi.getInstitutions(selectedType),
  });

  const institutions = useMemo(
    () =>
      (institutionsQuery.data ?? []).filter((institution) =>
        `${institution.institutionName} ${institution.location}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [institutionsQuery.data, search],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Institutions</h1>
          <p className="mt-2 text-slate-400">Browse schools and colleges seeking investor collaboration.</p>
        </div>
        <div className="w-full max-w-md">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search institutions" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedType === type
                ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30'
                : 'bg-slate-900 text-slate-300 ring-1 ring-slate-800 hover:text-white'
            }`}
          >
            {type === 'school' ? 'Schools' : 'Colleges'}
          </button>
        ))}
      </div>

      {institutionsQuery.isLoading ? (
        <Card className="p-8 text-sm text-slate-300">Loading connected institutions...</Card>
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
      <div className="grid gap-4 xl:grid-cols-2">
        {institutions.length > 0 ? (
          institutions.map((institution) => (
            <Card key={institution._id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-white">{institution.institutionName}</div>
                  <div className="mt-1 text-sm text-cyan-300">{institution.location}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge>{institution.focusLabel}</Badge>
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                      {institution.academicYear}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3 text-right">
                  <div>
                    <div className="text-2xl font-bold text-white">{institution.totalStudentsEnrolled}</div>
                    <div className="text-xs text-slate-400">Students</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{institution.iicStarRating.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">IIC Rating</div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="xl:col-span-2 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="mt-4 text-lg font-semibold text-white">No connected institutions</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {search
                    ? `No ${selectedType === 'school' ? 'schools' : 'colleges'} match "${search}". Clear the search or switch institution type to keep exploring.`
                    : `No ${selectedType === 'school' ? 'schools' : 'colleges'} are available in your investor institution feed yet.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  Clear search
                </button>
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
    </div>
  );
}

