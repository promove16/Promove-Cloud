import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { investorApi } from '../../api/investor.api';

const types = ['school', 'college'] as const;

export default function Institutions() {
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

      <div className="grid gap-4 xl:grid-cols-2">
        {institutions.map((institution) => (
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
        ))}
      </div>
    </div>
  );
}

