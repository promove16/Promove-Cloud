import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Rocket, Users2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { InstitutionStartup } from '../../types/school.types';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  basePath: string;
  fetchStartups: () => Promise<InstitutionStartup[]>;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatStatusLabel = (value?: string | null) => (value ?? 'draft').replace(/_/g, ' ');

export function InstitutionStartupsPageBase({
  mode,
  title,
  subtitle,
  basePath,
  fetchStartups,
}: Props) {
  const navigate = useNavigate();
  const params = useParams<{ startupId?: string }>();
  const selectedStartupId = params.startupId;

  const startupsQuery = useQuery({
    queryKey: ['institution-startups', mode],
    queryFn: fetchStartups,
  });

  const startups = startupsQuery.data ?? [];
  const selectedStartup = useMemo(
    () => startups.find((startup) => startup._id === selectedStartupId) ?? startups[0],
    [startups, selectedStartupId],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Startups</div>
        <h1 className="mt-2 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>

      {startupsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : null}

      {selectedStartup ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{selectedStartup.stage}</Badge>
            <Badge className="border-slate-700 bg-slate-900 text-slate-300">{selectedStartup.category}</Badge>
            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">
              {formatStatusLabel(selectedStartup.reviewStatus)}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">{selectedStartup.name}</h2>
          <p className="mt-2 text-slate-400">{selectedStartup.tagline}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: 'Founders', value: selectedStartup.founderNames.join(', ') || 'Not mapped', Icon: Users2 },
              { label: 'Active Products', value: String(selectedStartup.activeProducts), Icon: Boxes },
              { label: 'Team Size', value: String(selectedStartup.teamSize), Icon: Users2 },
              {
                label: 'Launched',
                value: selectedStartup.launchedAt ? formatDate(selectedStartup.launchedAt) : 'Not launched',
                Icon: Rocket,
              },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {startups.map((startup) => (
          <Card
            key={startup._id}
            className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
              startup._id === selectedStartup?._id ? 'border-cyan-500/40' : ''
            }`}
            onClick={() => navigate(`${basePath}/startups/${startup._id}`)}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white">{startup.name}</h3>
                  <Badge>{startup.stage}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-400">{startup.tagline}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span>{startup.founderNames.join(', ') || 'No founders mapped'}</span>
                  <span>{startup.activeProducts} active products</span>
                  <span>{startup.teamSize} team members</span>
                  <span>Updated {formatDate(startup.updatedAt)}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                {formatStatusLabel(startup.reviewStatus)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!startupsQuery.isLoading && startups.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">No startup records are available for this institution yet.</Card>
      ) : null}
    </div>
  );
}
