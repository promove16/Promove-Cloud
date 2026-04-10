import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { schoolApi } from '../../api/school.api';
import { Button } from '../../components/ui/Button';
import { ApiErrorResponse } from '../../types/auth.types';
import {
  BulkCredentialImportResult,
  TemporaryStudentCredentials,
} from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';
import { PatentShowcase } from '../shared/PatentShowcase';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';
import { StudentAccessWorkspace } from '../institution/StudentAccessWorkspace';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';
import {
  DashboardMetricRail,
  DashboardSection,
} from '../institution/dashboardSurface';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export default function OperationsPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [tokenLabel, setTokenLabel] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] = useState<TemporaryStudentCredentials | null>(
    null,
  );
  const [bulkCredentialResult, setBulkCredentialResult] = useState<BulkCredentialImportResult | null>(null);
  const [opsNotice, setOpsNotice] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['school-dashboard'],
    queryFn: schoolApi.getDashboard,
  });
  const tokenQuery = useQuery({
    queryKey: ['school-student-access-tokens'],
    queryFn: schoolApi.getStudentAccessTokens,
  });
  const pendingStudentsQuery = useQuery({
    queryKey: ['school-student-verifications'],
    queryFn: schoolApi.getPendingStudentVerifications,
  });
  const rosterQuery = useQuery({
    queryKey: ['school-student-roster'],
    queryFn: () => schoolApi.getStudentRoster(),
  });

  const createTokenMutation = useMutation({
    mutationFn: schoolApi.createStudentAccessToken,
    onSuccess: () => {
      setTokenLabel('');
      setOpsNotice('Student access token generated.');
      void queryClient.invalidateQueries({ queryKey: ['school-student-access-tokens'] });
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to generate this token right now.'));
    },
  });
  const createRosterEntryMutation = useMutation({
    mutationFn: schoolApi.createStudentRosterEntry,
    onSuccess: () => {
      setOpsNotice('Student roster entry created.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to add this student right now.'));
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: schoolApi.cancelStudentInvite,
    onSuccess: () => {
      setOpsNotice('Student invite cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['school-student-roster'] });
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to cancel this invite.'));
      void queryClient.invalidateQueries({ queryKey: ['school-student-roster'] });
    },
  });
  const createTemporaryCredentialMutation = useMutation({
    mutationFn: schoolApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      setOpsNotice('Temporary login created.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['school-student-verifications'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to create the temporary login right now.'));
    },
  });
  const importRosterWithCredentialsMutation = useMutation({
    mutationFn: schoolApi.importStudentRosterWithCredentials,
    onSuccess: (result) => {
      setBulkCredentialResult(result);
      setOpsNotice('Roster imported with generated credentials.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to import the roster with credentials.'));
    },
  });
  const importRosterMutation = useMutation({
    mutationFn: schoolApi.importStudentRoster,
    onSuccess: () => {
      setOpsNotice('Roster import complete.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to import the roster right now.'));
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ studentId, decision, reason }: { studentId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      schoolApi.reviewStudentVerification(studentId, { decision, reason }),
    onSuccess: () => {
      setOpsNotice('Verification review saved.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['school-students'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to review this student right now.'));
    },
  });

  const data = dashboardQuery.data;
  const institutionName = data?.institutionProfile?.institutionName ?? 'School Operations';
  const institutionDomainHint = authUser?.email?.split('@')[1];
  const tokenCount = tokenQuery.data?.length ?? 0;
  const pendingCount = pendingStudentsQuery.data?.length ?? 0;

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

  const statusHintItems = [
    {
      label: 'Students',
      value: data?.stats.totalStudents ?? 0,
      helper: 'Current school-wide roster',
      icon: Users,
    },
    {
      label: 'Pending',
      value: pendingCount,
      helper: 'Verification reviews waiting',
      icon: ShieldCheck,
    },
    {
      label: 'Tokens',
      value: tokenCount,
      helper: 'School access tokens issued',
      icon: KeyRound,
    },
    {
      label: 'Roster',
      value: rosterQuery.data?.length ?? 0,
      helper: 'Students added to the school intake list',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <InstitutionWorkspaceHeader
        mode="school"
        eyebrow="School Operations"
        title={institutionName}
        description="This page carries the heavier school workflows: approvals, access tokens, roster intake, and other supporting tasks that no longer belong on the main overview."
        tabsAction={
          <Link to="/dashboard/school">
            <Button variant="secondary">
              Back to Dashboard
              <ArrowLeft className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <DashboardMetricRail columnsClassName="md:grid-cols-4" items={statusHintItems} />

      {opsNotice ? (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {opsNotice}
        </div>
      ) : null}

      <div className="grid gap-6">
        <StudentAccessWorkspace
          tokenLabel={tokenLabel}
          tokenPlaceholder="Grade 12 innovators"
          tokenFallbackLabel="General student onboarding token"
          tokens={tokenQuery.data ?? []}
          pendingStudents={pendingStudentsQuery.data ?? []}
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
          description="Email roster invites, import student lists, and issue temporary credentials from one shared onboarding flow."
        >
          <StudentIntakePanel
            heading="Feed student data manually or from Excel"
            description="Create a school-managed roster and email invites automatically. Students who register with the same invited email get direct dashboard access, while token-only signups still wait for approval."
            secondaryFieldLabel="Class / Section"
            secondaryFieldPlaceholder="Grade 12 - A"
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
        </DashboardSection>
      </div>

      <PatentShowcase />
    </div>
  );
}
