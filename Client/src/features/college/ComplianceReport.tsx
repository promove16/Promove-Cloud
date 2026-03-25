import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { collegeApi } from '../../api/college.api';
import { ComplianceReportRecord } from '../../types/school.types';

export default function ComplianceReport() {
  const [reports, setReports] = useState<ComplianceReportRecord[]>([]);

  const dashboardQuery = useQuery({
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });

  const placementQuery = useQuery({
    queryKey: ['college-placement'],
    queryFn: collegeApi.getPlacementTracker,
  });

  const latestReportQuery = useQuery({
    queryKey: ['college-latest-report'],
    queryFn: collegeApi.getLatestComplianceReport,
  });

  useEffect(() => {
    if (latestReportQuery.data) {
      setReports([latestReportQuery.data]);
    }
  }, [latestReportQuery.data]);

  const generateMutation = useMutation({
    mutationFn: collegeApi.generateComplianceReport,
    onSuccess: (payload) => {
      const generatedAt = new Date().toISOString();
      setReports((current) => [
        {
          _id: `${generatedAt}-local`,
          institutionId: 'current',
          institutionType: 'college',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Compliance Report</h1>
          <p className="mt-2 text-slate-400">Enhanced institutional report with placement and IPR metrics.</p>
        </div>
        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? 'Generating report...' : 'Download Full Report (Enhanced)'}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          ['Total HR Connections', placementQuery.data?.hiringPartners.length ?? 0],
          ['Direct Shortlists This Quarter', (placementQuery.data?.placementTable ?? []).filter((record) => record.status === 'Shortlisted').length],
          ['Top Hiring Sector', placementQuery.data?.hiringPartners[0]?.domains[0] ?? 'General'],
          ['Placement Velocity', `${placementQuery.data?.placementVelocity ?? 0}%`],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="mt-2 text-sm text-slate-400">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">IPR & Innovation Metrics</div>
          <div className="space-y-3">
            {[
              ['Total Patents Filed', dashboardQuery.data?.stats.patentsFiled ?? 0],
              ['MVPs Launched', dashboardQuery.data?.stats.startupsLaunched ?? 0],
              ['Total Penny Investments Raised', 'INR 0'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="font-medium text-white">{label}</div>
                <div className="text-cyan-300">{value}</div>
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
                    <div className="font-semibold text-white">{new Date(report.generatedAt).toLocaleString('en-IN')}</div>
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
    </div>
  );
}
