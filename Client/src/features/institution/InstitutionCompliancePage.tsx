import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';
import type {
  ComplianceOverviewData,
  ComplianceEvidenceUploadResponse,
  ComplianceReportRecord,
  InstitutionPolicy,
  InstitutionPolicySubmissionRecord,
} from '../../types/school.types';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';
import { InstitutionComplianceVerificationTab } from './InstitutionComplianceVerificationTab';

type InstitutionCompliancePageProps = {
  mode: 'school' | 'college';
  institutionLabel: 'School' | 'College';
  fetchOverview: () => Promise<ComplianceOverviewData>;
  fetchSubmission: () => Promise<InstitutionPolicySubmissionRecord | null>;
  submitSubmission: (payload: {
    policies: InstitutionPolicy[];
    summaryNote?: string;
  }) => Promise<InstitutionPolicySubmissionRecord>;
  requestEvidenceEdit: (payload: {
    submissionId: string;
    policyName: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) => Promise<{ requestedAt: string; submissionId: string }>;
  uploadEvidenceFile: (file: File) => Promise<ComplianceEvidenceUploadResponse>;
  fetchLatestReport: () => Promise<ComplianceReportRecord | null>;
  generateReport: () => Promise<{ reportUrl: string }>;
};

const PANEL_CLASS_NAME =
  'border border-[#1c2435] bg-[#0a1220] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.32)] sm:px-7';

const HEADER_PANEL_CLASS_NAME =
  'overflow-hidden border border-[#1b2942] bg-[#08111f] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.4)] sm:px-7';

const formatDate = (value?: string) => {
  if (!value) {
    return 'Awaiting sync';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Awaiting sync';
  }

  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function InstitutionCompliancePage({
  mode,
  institutionLabel,
  fetchOverview,
  fetchSubmission,
  submitSubmission,
  requestEvidenceEdit,
  uploadEvidenceFile,
  fetchLatestReport,
  generateReport,
}: InstitutionCompliancePageProps) {
  const queryClient = useQueryClient();
  const queryPrefix = `${mode}-compliance`;

  const overviewQuery = useQuery({
    queryKey: [queryPrefix, 'overview'],
    queryFn: fetchOverview,
  });

  const submissionQuery = useQuery({
    queryKey: [queryPrefix, 'submission'],
    queryFn: fetchSubmission,
  });

  const latestReportQuery = useQuery({
    queryKey: [queryPrefix, 'latest-report'],
    queryFn: fetchLatestReport,
  });

  const submitMutation = useMutation({
    mutationFn: submitSubmission,
    onSuccess: async () => {
      toast.success('Compliance packet submitted for admin review.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [queryPrefix, 'submission'] }),
        queryClient.invalidateQueries({ queryKey: [queryPrefix, 'overview'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to submit the compliance packet right now.'));
    },
  });

  const reportMutation = useMutation({
    mutationFn: generateReport,
    onSuccess: async (result) => {
      toast.success('Compliance report generated.');
      await queryClient.invalidateQueries({ queryKey: [queryPrefix, 'latest-report'] });
      window.open(result.reportUrl, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to generate the compliance report right now.'));
    },
  });

  const requestEvidenceEditMutation = useMutation({
    mutationFn: requestEvidenceEdit,
    onSuccess: () => {
      toast.success('Edit request sent to admin.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to request edit access right now.'));
    },
  });

  const overview = overviewQuery.data;
  const latestReport = latestReportQuery.data;
  const isInitialLoading =
    overviewQuery.isLoading && submissionQuery.isLoading && latestReportQuery.isLoading;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className={HEADER_PANEL_CLASS_NAME}>
        <InstitutionWorkspaceHeader
          mode={mode}
          eyebrow={`${institutionLabel} Workspace`}
          title="Compliance"
          description="Manage framework status, admin verification, audit alerts, and report exports."
          showMenu={false}
          headerAction={
            <div className="flex flex-wrap gap-2">
              {latestReport?.pdfUrl ? (
                <Button
                  variant="secondary"
                  className="gap-2 py-2.5"
                  onClick={() => window.open(latestReport.pdfUrl, '_blank', 'noopener,noreferrer')}
                >
                  <Download className="h-4 w-4" />
                  Latest Report
                </Button>
              ) : null}
              <Button
                className="gap-2 py-2.5"
                onClick={() => reportMutation.mutate()}
                disabled={reportMutation.isPending}
              >
                <FileCheck2 className="h-4 w-4" />
                {reportMutation.isPending ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          }
        />
      </div>

      <div className={PANEL_CLASS_NAME}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ComplianceMetric
            icon={ShieldCheck}
            label="Frameworks"
            value={overview?.frameworkSummary.total ?? 0}
            helper={`${overview?.frameworkSummary.onTrack ?? 0} on track`}
          />
          <ComplianceMetric
            icon={Clock3}
            label="Pending Reviews"
            value={
              (overview?.frameworkSummary.inProgress ?? 0) +
              (overview?.actionSummary.pending ?? 0)
            }
            helper={`${overview?.actionSummary.inProgress ?? 0} actions in progress`}
          />
          <ComplianceMetric
            icon={AlertTriangle}
            label="Unread Alerts"
            value={overview?.alertSummary.unread ?? 0}
            helper={`${overview?.alertSummary.critical ?? 0} critical alerts`}
          />
          <ComplianceMetric
            icon={CheckCircle2}
            label="Latest Report"
            value={latestReport ? 'Ready' : 'None'}
            helper={latestReport ? formatDate(latestReport.generatedAt) : 'Generate when evidence is current'}
          />
        </div>
      </div>

      <div className={PANEL_CLASS_NAME}>
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Framework Status</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Policy compliance panel</h2>
        </div>

        {overview?.frameworks.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {overview.frameworks.map((framework) => (
              <div key={framework.name} className="border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{framework.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {framework.lastUpdated ? `Updated ${formatDate(framework.lastUpdated)}` : 'Awaiting update'}
                    </div>
                  </div>
                  <span className={getStatusClassName(framework.status)}>
                    {framework.displayStatus}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-400">{framework.scoreLevel}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">
            {overviewQuery.isLoading ? 'Loading compliance frameworks...' : 'No compliance frameworks available yet.'}
          </div>
        )}
      </div>

      <InstitutionComplianceVerificationTab
        mode={mode}
        frameworks={overview?.frameworks ?? []}
        submission={submissionQuery.data}
        isLoadingSubmission={submissionQuery.isLoading}
        isSubmitting={submitMutation.isPending}
        isRequestingEdit={requestEvidenceEditMutation.isPending}
        uploadEvidenceFile={uploadEvidenceFile}
        onRequestEvidenceEdit={(payload) => requestEvidenceEditMutation.mutate(payload)}
        onSubmit={(payload) => submitMutation.mutate(payload)}
      />
    </div>
  );
}

function ComplianceMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <Card className="rounded-none border-[#1a2233] bg-[#0b1221] px-4 py-4 shadow-none">
      <div className="flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-900">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="mt-4 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm font-semibold text-slate-200">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </Card>
  );
}

function getStatusClassName(status: ComplianceOverviewData['frameworks'][number]['status']) {
  const baseClassName =
    'inline-flex shrink-0 border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]';

  if (status === 'on_track') {
    return `${baseClassName} border-emerald-700 bg-emerald-900 text-emerald-200`;
  }

  if (status === 'in_progress') {
    return `${baseClassName} border-amber-700 bg-amber-900 text-amber-100`;
  }

  return `${baseClassName} border-rose-700 bg-rose-900 text-rose-200`;
}
