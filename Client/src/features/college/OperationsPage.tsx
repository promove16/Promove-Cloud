import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { collegeApi } from '../../api/college.api';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';
import { StudentAccessWorkspace } from '../institution/StudentAccessWorkspace';
import { PatentShowcase } from '../shared/PatentShowcase';
import { ApiErrorResponse } from '../../types/auth.types';
import { TemporaryStudentCredentials } from '../../types/college.types';
import { BulkCredentialImportResult } from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';
import {
  DashboardSection,
} from '../institution/dashboardSurface';

type OperationsPageProps = {
  onBackToOverview?: () => void;
};

export default function OperationsPage({ onBackToOverview }: OperationsPageProps) {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [tokenLabel, setTokenLabel] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] =
    useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] =
    useState<BulkCredentialImportResult | null>(null);
  const [rosterNotice, setRosterNotice] = useState('');

  const tokenQuery = useQuery({
    queryKey: ['college-student-access-tokens'],
    queryFn: collegeApi.getStudentAccessTokens,
  });
  const pendingStudentsQuery = useQuery({
    queryKey: ['college-student-verifications'],
    queryFn: collegeApi.getPendingStudentVerifications,
  });
  const rosterQuery = useQuery({
    queryKey: ['college-student-roster'],
    queryFn: () => collegeApi.getStudentRoster(),
  });

  const createTokenMutation = useMutation({
    mutationFn: collegeApi.createStudentAccessToken,
    onSuccess: () => {
      setTokenLabel('');
      void queryClient.invalidateQueries({ queryKey: ['college-student-access-tokens'] });
    },
  });
  const createRosterEntryMutation = useMutation({
    mutationFn: collegeApi.createStudentRosterEntry,
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: collegeApi.cancelStudentInvite,
    onSuccess: () => {
      setRosterNotice('Student invite cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
    },
    onError: (error) => {
      const message =
        isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
          ? error.response.data.error.message
          : 'Unable to cancel this invite.';
      setRosterNotice(message);
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
    },
  });
  const createTemporaryCredentialMutation = useMutation({
    mutationFn: collegeApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['college-student-verifications'] }),
      ]);
    },
  });
  const importRosterMutation = useMutation({
    mutationFn: collegeApi.importStudentRoster,
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
  });
  const importRosterWithCredentialsMutation = useMutation({
    mutationFn: collegeApi.importStudentRosterWithCredentials,
    onSuccess: (result) => {
      setBulkCredentialResult(result);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      studentId,
      decision,
      reason,
    }: {
      studentId: string;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => collegeApi.reviewStudentVerification(studentId, { decision, reason }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['college-students'] }),
      ]);
    },
  });

  const institutionDomainHint = authUser?.email?.split('@')[1];
  const pendingTokens = tokenQuery.data ?? [];
  const pendingStudents = pendingStudentsQuery.data ?? [];

  const handleCreateToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTokenMutation.mutate({
      ...(tokenLabel.trim() ? { label: tokenLabel.trim() } : {}),
    });
  };

  const handleReject = (studentId: string) => {
    const reason = window.prompt('Add a short reason for rejection (optional):')?.trim();
    reviewMutation.mutate({
      studentId,
      decision: 'rejected',
      ...(reason ? { reason } : {}),
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-slate-800/70 bg-slate-950/55">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/70 px-6 py-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Operations Workspace</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">College operations page</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Token desk, approval queue, and student intake live here so the dashboard can stay
            within one viewport.
          </p>
        </div>

        {onBackToOverview ? (
          <Button variant="secondary" onClick={onBackToOverview}>
            Back to overview
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-3 border-b border-slate-800/70 pb-6 md:grid-cols-3">
          {[
            {
              icon: Users,
              label: 'Student intake',
              value: 'Manual, bulk, and temporary credential workflows stay available.',
            },
            {
              icon: KeyRound,
              label: 'Token desk',
              value: 'Generate and monitor student verification tokens from one place.',
            },
            {
              icon: Sparkles,
              label: 'Approval queue',
              value: 'Pending student registrations are reviewed from this page.',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-800/70 bg-slate-900/30 p-4">
              <item.icon className="h-4 w-4 text-cyan-300" />
              <div className="mt-3 text-sm font-medium text-white">{item.label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6">
          <div className="space-y-6">
            <StudentAccessWorkspace
              tokenLabel={tokenLabel}
              tokenPlaceholder="2026 incubator cohort"
              tokenFallbackLabel="General college onboarding token"
              tokens={pendingTokens}
              pendingStudents={pendingStudents}
              isCreatingToken={createTokenMutation.isPending}
              isReviewingStudents={reviewMutation.isPending}
              onTokenLabelChange={setTokenLabel}
              onCreateToken={handleCreateToken}
              onApproveStudent={(studentId) => reviewMutation.mutate({ studentId, decision: 'approved' })}
              onRejectStudent={handleReject}
            />

            <DashboardSection
              eyebrow="Student Onboarding"
              title="Student onboarding"
              description="Create managed student intake records, import rosters, and issue temporary credentials."
            >
              <div className="space-y-4">
                <StudentIntakePanel
                  heading="Feed student intake data for your college"
                  description="Build a managed roster, email temporary student credentials, or issue tokens for approved self-service signup."
                  secondaryFieldLabel="Program / Year"
                  secondaryFieldPlaceholder="B.Tech CSE - 3rd Year"
                  roster={rosterQuery.data ?? []}
                  institutionDomainHint={institutionDomainHint}
                  isRosterLoading={rosterQuery.isLoading}
                  isManualSubmitting={createRosterEntryMutation.isPending}
                  isImportSubmitting={importRosterMutation.isPending}
                  isImportWithCredentialsSubmitting={importRosterWithCredentialsMutation.isPending}
                  isTemporaryCredentialSubmitting={createTemporaryCredentialMutation.isPending}
                  temporaryCredential={latestTemporaryCredential}
                  bulkCredentialResult={bulkCredentialResult}
                  onCreateManualEntry={(payload) => createRosterEntryMutation.mutate(payload)}
                  onCancelInvite={(rosterEntryId) => {
                    if (window.confirm('Cancel this student invite?')) {
                      cancelInviteMutation.mutate(rosterEntryId);
                    }
                  }}
                  cancellingInviteId={cancelInviteMutation.isPending ? cancelInviteMutation.variables : null}
                  onImportFile={(file) => importRosterMutation.mutate(file)}
                  onImportFileWithCredentials={(file) => importRosterWithCredentialsMutation.mutate(file)}
                  onCreateTemporaryCredentials={(payload) => createTemporaryCredentialMutation.mutate(payload)}
                />

                {rosterNotice ? (
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
                    {rosterNotice}
                  </div>
                ) : null}
              </div>
            </DashboardSection>
          </div>
        </div>

        <div className="mt-6">
          <PatentShowcase />
        </div>
      </div>
    </section>
  );
}
