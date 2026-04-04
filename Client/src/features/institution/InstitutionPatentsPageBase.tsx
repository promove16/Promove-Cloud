import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarDays, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { InstitutionPatent } from '../../types/school.types';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  basePath: string;
  fetchPatents: () => Promise<InstitutionPatent[]>;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const patentTone = (status: string) => {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'under_review':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'rejected':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
};

export function InstitutionPatentsPageBase({
  mode,
  title,
  subtitle,
  basePath,
  fetchPatents,
}: Props) {
  const navigate = useNavigate();
  const params = useParams<{ patentId?: string }>();
  const selectedPatentId = params.patentId;

  const patentsQuery = useQuery({
    queryKey: ['institution-patents', mode],
    queryFn: fetchPatents,
  });

  const patents = patentsQuery.data ?? [];
  const selectedPatent = useMemo(
    () => patents.find((patent) => patent._id === selectedPatentId) ?? patents[0],
    [patents, selectedPatentId],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patents</div>
        <h1 className="mt-2 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>

      {patentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : null}

      {selectedPatent ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className={patentTone(selectedPatent.status)}>{selectedPatent.status.replace(/_/g, ' ')}</Badge>
              </div>
              <h2 className="text-2xl font-semibold text-white">{selectedPatent.projectTitle}</h2>
              <p className="mt-2 text-slate-400">
                Patent activity filed by {selectedPatent.studentName}. Use this child page to inspect patent status
                outside the compressed dashboard metric.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate(`${basePath}/students/${selectedPatent.studentId}`)}>
              View Student Journey
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Student', value: selectedPatent.studentName, Icon: UserRound },
              { label: 'Status', value: selectedPatent.status.replace(/_/g, ' '), Icon: Award },
              { label: 'Submitted', value: formatDate(selectedPatent.submittedAt), Icon: CalendarDays },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 text-lg font-semibold capitalize text-white">{value}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {patents.map((patent) => (
          <Card
            key={patent._id}
            className={`cursor-pointer p-5 transition-colors hover:border-slate-700 ${
              patent._id === selectedPatent?._id ? 'border-cyan-500/40' : ''
            }`}
            onClick={() => navigate(`${basePath}/patents/${patent._id}`)}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white">{patent.projectTitle}</h3>
                  <Badge className={patentTone(patent.status)}>{patent.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {patent.studentName} • Submitted {formatDate(patent.submittedAt)}
                </div>
              </div>
              <Button variant="secondary" onClick={(event) => {
                event.stopPropagation();
                navigate(`${basePath}/students/${patent.studentId}`);
              }}>
                View Student
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {!patentsQuery.isLoading && patents.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">No patent records are available for this institution yet.</Card>
      ) : null}
    </div>
  );
}
