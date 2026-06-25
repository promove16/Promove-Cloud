import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, CheckCircle2, Clock3, Sparkles, Users } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterDriveSectionItems,
} from './RecruiterSectionNav';

type OnboardingTrackerProps = {
  embedded?: boolean;
};

const statusBadgeClass = (status: string) => {
  if (status === 'Hired') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'Shortlisted') {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  }
  if (status === 'In Progress') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-700 bg-slate-900 text-slate-300';
};

export default function OnboardingTracker({ embedded = false }: OnboardingTrackerProps) {
  const onboardingQuery = useQuery({
    queryKey: ['recruiter', 'onboarding'],
    queryFn: recruiterApi.getOnboarding,
  });

  const rows = onboardingQuery.data ?? [];

  const metrics = useMemo(
    () => ({
      total: rows.length,
      shortlisted: rows.filter((record) => record.status === 'Shortlisted').length,
      inProgress: rows.filter((record) => record.status === 'In Progress').length,
      hired: rows.filter((record) => record.status === 'Hired').length,
    }),
    [rows],
  );

  const markHired = async (studentId: string, companyName?: string) => {
    await recruiterApi.markHired(studentId, companyName ?? 'ProMove Partner');
    await onboardingQuery.refetch();
  };

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      {!embedded ? (
        <RecruiterSectionHeader
          eyebrow="Campus Hiring"
          title="Track students after shortlist and hire actions"
          description="This tracker now reflects recruiter placement rows and active hiring progress so shortlisted candidates do not disappear from view."
          navItems={recruiterDriveSectionItems}
        />
      ) : null}

      {onboardingQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{metrics.total}</div>
                  <div className="text-sm text-slate-400">Tracked students</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{metrics.shortlisted}</div>
                  <div className="text-sm text-slate-400">Shortlisted</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{metrics.inProgress}</div>
                  <div className="text-sm text-slate-400">In progress</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{metrics.hired}</div>
                  <div className="text-sm text-slate-400">Confirmed hires</div>
                </div>
              </div>
            </Card>
          </div>

          {rows.length === 0 ? (
            <Card className="p-8">
              <div className="text-lg font-semibold text-white">No onboarding activity yet</div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                This page fills from recruiter shortlist, application-stage, and hire actions. Once a student moves into
                recruiter follow-through, their record appears here.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((record) => (
                <Card key={record._id} className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xl font-semibold text-white">{record.studentName}</div>
                        <Badge className={statusBadgeClass(record.status)}>{record.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        <span>Score {record.innovationScore}</span>
                        <span>{record.collegeName ?? 'College not linked'}</span>
                        <span>{new Date(record.updatedAt).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:min-w-[280px] xl:items-end">
                      <div className="text-sm text-slate-400">
                        {record.companyName ?? 'Awaiting recruiter action'}
                      </div>
                      {record.status === 'Hired' ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirmed
                        </Badge>
                      ) : (
                        <Button variant="secondary" onClick={() => markHired(record.studentId, record.companyName)}>
                          <BriefcaseBusiness className="mr-2 h-4 w-4" />
                          Mark as Hired
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
