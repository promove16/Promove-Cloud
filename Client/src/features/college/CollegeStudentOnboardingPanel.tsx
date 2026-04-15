import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Users } from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { ApiErrorResponse } from '../../types/auth.types';
import { TemporaryStudentCredentials } from '../../types/college.types';
import { BulkCredentialImportResult } from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';
import { DashboardMetricRail, DashboardSection } from '../institution/dashboardSurface';
import { StudentAccessWorkspace } from '../institution/StudentAccessWorkspace';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) &&
    error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export function CollegeStudentOnboardingPanel() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [tokenLabel, setTokenLabel] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] =
    useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] =
    useState<BulkCredentialImportResult | null>(null);
  const [opsNotice, setOpsNotice] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });
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
      setOpsNotice('Access token issued.');
      void queryClient.invalidateQueries({
        queryKey: ['college-student-access-tokens'],
      });
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to issue an access token right now.'));
    },
  });
  const createRosterEntryMutation = useMutation({
    mutationFn: collegeApi.createStudentRosterEntry,
    onSuccess: () => {
      setOpsNotice('Student invite created.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to add this student right now.'));
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: collegeApi.cancelStudentInvite,
    onSuccess: () => {
      setOpsNotice('Student invite cancelled.');
      void queryClient.invalidateQueries({
        queryKey: ['college-student-roster'],
      });
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to cancel this invite.'));
      void queryClient.invalidateQueries({
        queryKey: ['college-student-roster'],
      });
    },
  });
  const createTemporaryCredentialMutation = useMutation({
    mutationFn: collegeApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      setOpsNotice('Temporary login created.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['college-student-verifications'],
        }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(
        getErrorMessage(error, 'Unable to create the temporary login right now.'),
      );
    },
  });
  const importRosterMutation = useMutation({
    mutationFn: collegeApi.importStudentRoster,
    onSuccess: () => {
      setOpsNotice('Roster import complete.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to import the roster right now.'));
    },
  });
  const importRosterWithCredentialsMutation = useMutation({
    mutationFn: collegeApi.importStudentRosterWithCredentials,
    onSuccess: (result) => {
      setBulkCredentialResult(result);
      setOpsNotice('Roster imported with generated credentials.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(
        getErrorMessage(error, 'Unable to import the roster with credentials.'),
      );
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
      setOpsNotice('Verification review saved.');
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['college-student-verifications'],
        }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['college-students'] }),
      ]);
    },
    onError: (error) => {
      setOpsNotice(getErrorMessage(error, 'Unable to review this student right now.'));
    },
  });

  const institutionDomainHint = authUser?.email?.split('@')[1];
  const pendingCount = pendingStudentsQuery.data?.length ?? 0;
  const tokenCount = tokenQuery.data?.length ?? 0;
  const rosterCount = rosterQuery.data?.length ?? 0;
  const totalStudents = dashboardQuery.data?.stats.totalStudents ?? 0;

  const handleCreateToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTokenMutation.mutate({
      ...(tokenLabel.trim() ? { label: tokenLabel.trim() } : {}),
    });
  };

  const handleReject = (studentId: string) => {
    const reason = window
      .prompt('Add a short reason for rejection (optional):')
      ?.trim();
    reviewMutation.mutate({
      studentId,
      decision: 'rejected',
      ...(reason ? { reason } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <DashboardMetricRail
        columnsClassName="md:grid-cols-4"
        items={[
          {
            label: 'Students',
            value: totalStudents,
            helper: 'Current verified college roster',
            icon: Users,
          },
          {
            label: 'Pending',
            value: pendingCount,
            helper: 'Verification reviews waiting',
            icon: ShieldCheck,
          },
          {
            label: 'Access Tokens',
            value: tokenCount,
            helper: 'Issued student access tokens',
            icon: KeyRound,
          },
          {
            label: 'Roster',
            value: rosterCount,
            helper: 'Students added to the onboarding list',
            icon: Users,
          },
        ]}
      />

      {opsNotice ? (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {opsNotice}
        </div>
      ) : null}

      <StudentAccessWorkspace
        tokenLabel={tokenLabel}
        tokenPlaceholder="2026 placement cohort"
        tokenFallbackLabel="General college onboarding token"
        tokens={tokenQuery.data ?? []}
        pendingStudents={pendingStudentsQuery.data ?? []}
        isCreatingToken={createTokenMutation.isPending}
        isReviewingStudents={reviewMutation.isPending}
        onTokenLabelChange={setTokenLabel}
        onCreateToken={handleCreateToken}
        onApproveStudent={(studentId) =>
          reviewMutation.mutate({ studentId, decision: 'approved' })
        }
        onRejectStudent={handleReject}
      />

      <DashboardSection
        eyebrow="Student Onboarding"
        title="Student onboarding"
        description="Email roster invites, import student lists, and issue temporary credentials from the student workspace."
      >
        <StudentIntakePanel
          heading="Feed student intake data for your college"
          description="Build a managed roster and email invites automatically. Students who register with the same invited email get direct dashboard access, while token-only signups still wait for approval."
          secondaryFieldLabel="Program / Year"
          secondaryFieldPlaceholder="B.Tech CSE - 3rd Year"
          roster={rosterQuery.data ?? []}
          institutionDomainHint={institutionDomainHint}
          isRosterLoading={rosterQuery.isLoading}
          isManualSubmitting={createRosterEntryMutation.isPending}
          isImportSubmitting={importRosterMutation.isPending}
          isImportWithCredentialsSubmitting={
            importRosterWithCredentialsMutation.isPending
          }
          isTemporaryCredentialSubmitting={
            createTemporaryCredentialMutation.isPending
          }
          temporaryCredential={latestTemporaryCredential}
          bulkCredentialResult={bulkCredentialResult}
          onCreateManualEntry={(payload) =>
            createRosterEntryMutation.mutate(payload)
          }
          onCancelInvite={(rosterEntryId) => {
            if (window.confirm('Cancel this student invite?')) {
              cancelInviteMutation.mutate(rosterEntryId);
            }
          }}
          cancellingInviteId={
            cancelInviteMutation.isPending
              ? cancelInviteMutation.variables
              : null
          }
          onImportFile={(file) => importRosterMutation.mutate(file)}
          onImportFileWithCredentials={(file) =>
            importRosterWithCredentialsMutation.mutate(file)
          }
          onCreateTemporaryCredentials={(payload) =>
            createTemporaryCredentialMutation.mutate(payload)
          }
        />
      </DashboardSection>
    </div>
  );
}
