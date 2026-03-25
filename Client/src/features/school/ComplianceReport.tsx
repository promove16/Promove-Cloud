import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { schoolApi } from '../../api/school.api';
import { ComplianceReportRecord } from '../../types/school.types';

const statusTone: Record<string, string> = {
  Active: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  'On Track': 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  Pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Inactive: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

export default function ComplianceReport() {
  const [reports, setReports] = useState<ComplianceReportRecord[]>([]);

  const dashboardQuery = useQuery({
    queryKey: ['school-dashboard'],
    queryFn: schoolApi.getDashboard,
  });

  const latestReportQuery = useQuery({
    queryKey: ['school-latest-report'],
    queryFn: schoolApi.getLatestComplianceReport,
  });

  useEffect(() => {
    if (latestReportQuery.data) {
      setReports([latestReportQuery.data]);
    }
  }, [latestReportQuery.data]);

  const generateMutation = useMutation({
    mutationFn: schoolApi.generateComplianceReport,
    onSuccess: (payload) => {
      const generatedAt = new Date().toISOString();
      setReports((current) => [
        {
          _id: `${generatedAt}-local`,
          institutionId: 'current',
          institutionType: 'school',
          generatedAt,
          pdfUrl: payload.reportUrl,
          academicYear: dashboardQuery.data?.institutionProfile?.academicYear ?? 'Current AY',
          kpis: {},
        },
        ...current,
      ]);
      window.open(payload.reportUrl, '_blank', 'noopener,noreferrer');
    },
  });

  const topStudents = useMemo(() => dashboardQuery.data?.topStudents ?? [], [dashboardQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Policy Compliance Panel</h1>
          <p className="mt-2 text-slate-400">
            Review policy milestones, institutional KPIs, and download the latest compliance report.
          </p>
        </div>
        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? 'Generating report...' : 'Download Full Report'}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1.3fr]">
        <Card className="p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">IIC Star Rating</div>
          <div className="mt-4 text-4xl font-bold text-white">
            {(dashboardQuery.data?.institutionProfile?.iicStarRating ?? 0).toFixed(1)} / 5.0
          </div>
          <div className="mt-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            ON TRACK
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Policy Breakdown</div>
          <div className="space-y-3">
            {(dashboardQuery.data?.institutionProfile?.policies ?? []).map((policy) => (
              <div
                key={policy.name}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 md:grid-cols-[1.8fr,140px,140px]"
              >
                <div className="font-medium text-white">{policy.name}</div>
                <div
                  className={`rounded-full border px-3 py-1 text-center text-xs font-semibold ${statusTone[policy.status]}`}
                >
                  {policy.status}
                </div>
                <div className="text-sm text-slate-400">
                  {policy.lastUpdated
                    ? new Date(policy.lastUpdated).toLocaleDateString('en-IN')
                    : 'No update yet'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          ['Total Students', dashboardQuery.data?.stats.totalStudents ?? 0],
          ['Innovation Activities', dashboardQuery.data?.stats.totalInnovationActivities ?? 0],
          ['Patents', dashboardQuery.data?.stats.patentsFiled ?? 0],
          ['Mentoring Hours', dashboardQuery.data?.stats.totalMentoringHours ?? 0],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="mt-2 text-sm text-slate-400">{label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Top 5 Student Innovators</div>
        <div className="space-y-3">
          {topStudents.map((student) => (
            <div key={student._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
              <div className="font-semibold text-white">
                {student.rank}. {student.displayName}
              </div>
              <div className="text-cyan-300">{student.innovationScore}/200</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Previous Reports</div>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No report generated yet.
            </div>
          ) : (
            reports.map((report) => (
              <div key={report._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div>
                  <div className="font-semibold text-white">
                    {new Date(report.generatedAt).toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-slate-400">{report.academicYear}</div>
                </div>
                <Button variant="secondary" onClick={() => window.open(report.pdfUrl, '_blank', 'noopener,noreferrer')}>
                  Open PDF
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
