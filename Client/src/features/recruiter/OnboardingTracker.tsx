import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

export default function OnboardingTracker() {
  const onboardingQuery = useQuery({
    queryKey: ['recruiter', 'onboarding'],
    queryFn: recruiterApi.getOnboarding,
  });

  const markHired = async (studentId: string, companyName?: string) => {
    await recruiterApi.markHired(studentId, companyName ?? 'ProMove Partner');
    await onboardingQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" />
          Onboarding Tracker
        </div>
        <h1 className="text-3xl font-bold text-white">Track students after shortlist and hire actions</h1>
        <p className="mt-2 text-slate-400">Every status row is recruiter-driven, with hired actions updating placement records.</p>
      </div>

      {onboardingQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.5fr,120px,160px,1fr,160px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
            <div>Student</div>
            <div>Score</div>
            <div>Status</div>
            <div>Company</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-slate-800">
            {(onboardingQuery.data ?? []).map((record) => (
              <div
                key={record._id}
                className="grid grid-cols-[1.5fr,120px,160px,1fr,160px] items-center gap-4 px-5 py-4"
              >
                <div>
                  <div className="font-semibold text-white">{record.studentName}</div>
                  <div className="mt-1 text-sm text-slate-500">{new Date(record.updatedAt).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="text-white">{record.innovationScore}</div>
                <div>
                  <Badge
                    className={
                      record.status === 'Hired'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : record.status === 'Shortlisted'
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                    }
                  >
                    {record.status}
                  </Badge>
                </div>
                <div className="text-slate-400">{record.companyName ?? 'Awaiting recruiter action'}</div>
                <div>
                  {record.status === 'Hired' ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmed
                    </Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => markHired(record.studentId, record.companyName)}>
                      Mark as Hired
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
