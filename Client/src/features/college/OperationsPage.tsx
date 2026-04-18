import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Users, X } from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { ApiErrorResponse } from '../../types/auth.types';
import { TemporaryStudentCredentials } from '../../types/college.types';
import { BulkCredentialImportResult } from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';
import { DashboardMetricRail, DashboardSection } from '../institution/dashboardSurface';
import { StudentAccessWorkspace } from '../institution/StudentAccessWorkspace';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) &&
    error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export default function OperationsPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [tokenLabel, setTokenLabel] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] =
    useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] =
    useState<BulkCredentialImportResult | null>(null);

  // Inline rejection dialog state
  const [pendingReject, setPendingReject] = useState<{ studentId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Inline cancel-invite confirmation state
  const [pendingCancelInviteId, setPendingCancelInviteId] = useState<string | null>(null);

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
      void queryClient.invalidateQueries({
        queryKey: ['college-student-access-tokens'],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to issue an access token right now.'));
    },
  });
  const createRosterEntryMutation = useMutation({
    mutationFn: collegeApi.createStudentRosterEntry,
    onSuccess: (entry) => {
      toast.success(
        entry.status === 'invited' && !entry.linkedUserId
          ? 'Student invite saved. Registration email sent.'
          : 'Student roster entry saved.',
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to add this student right now.'));
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: collegeApi.cancelStudentInvite,
    onSuccess: () => {
      toast.success('Student invite cancelled.');
      setPendingCancelInviteId(null);
      void queryClient.invalidateQueries({
        queryKey: ['college-student-roster'],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to cancel this invite.'));
      setPendingCancelInviteId(null);
      void queryClient.invalidateQueries({
        queryKey: ['college-student-roster'],
      });
    },
  });
  const createTemporaryCredentialMutation = useMutation({
    mutationFn: collegeApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['college-student-verifications'],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, 'Unable to create the temporary login right now.'),
      );
    },
  });
  const importRosterMutation = useMutation({
    mutationFn: collegeApi.importStudentRoster,
    onSuccess: () => {
      toast.success('Roster import complete.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to import the roster right now.'));
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
    onError: (error) => {
      toast.error(
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
      toast.success('Verification review saved.');
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['college-student-verifications'],
        }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['college-students'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to review this student right now.'));
    },
  });

  const institutionDomainHint = authUser?.email?.split('@')[1];
  const pendingCount = pendingStudentsQuery.data?.length ?? 0;
  const tokenCount = tokenQuery.data?.length ?? 0;
  const rosterCount = rosterQuery.data?.length ?? 0;
  const totalStudents = dashboardQuery.data?.stats.totalStudents ?? 0;
  const institutionName =
    dashboardQuery.data?.institutionProfile?.institutionName ?? 'College Operations';

  const handleCreateToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTokenMutation.mutate({
      ...(tokenLabel.trim() ? { label: tokenLabel.trim() } : {}),
    });
  };

  const handleConfirmReject = () => {
    if (!pendingReject) return;
    reviewMutation.mutate({
      studentId: pendingReject.studentId,
      decision: 'rejected',
      ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
    });
    setPendingReject(null);
    setRejectReason('');
  };

  const statusHintItems = [
    {
      label: 'Students',
      value: totalStudents,
      helper: 'Current verified college roster',
      icon: Users,
    },
    {
      label: 'Approval Queue',
      value: pendingCount,
      helper: 'Students needing direct institution review',
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
  ];

  return (
    <div className="space-y-8 pb-8">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="College Operations"
        title={institutionName}
        description="Manage student access tokens, process verification approvals, and handle roster onboarding from one place."
      />

      <DashboardMetricRail
        columnsClassName="md:grid-cols-4"
        items={statusHintItems}
      />

      <div className="grid gap-6">
        <StudentAccessWorkspace
          tokenLabel={tokenLabel}
          tokenPlaceholder="2026 placement cohort"
          tokenFallbackLabel="General college onboarding token"
          tokens={tokenQuery.data ?? []}
          pendingStudents={pendingStudentsQuery.data ?? []}
          rosterPendingCount={
            (rosterQuery.data ?? []).filter(
              (entry) => entry.status === 'registered_pending',
            ).length
          }
          isCreatingToken={createTokenMutation.isPending}
          isReviewingStudents={reviewMutation.isPending}
          onTokenLabelChange={setTokenLabel}
          onCreateToken={handleCreateToken}
          onApproveStudent={(studentId) =>
            reviewMutation.mutate({ studentId, decision: 'approved' })
          }
          onRejectStudent={(studentId) => {
            setPendingReject({ studentId });
            setRejectReason('');
          }}
        />

        <DashboardSection
          eyebrow="Student Onboarding"
          title="Student onboarding"
          description="Email roster invites, import student lists, and issue temporary credentials from the student workspace."
        >
          <StudentIntakePanel
            heading="Feed student intake data for your college"
            description="Build a managed roster and email invites automatically. Students who register with the same invited email move into the institution onboarding flow, while unmatched token signups wait for the institution review path."
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
              createRosterEntryMutation.mutateAsync(payload)
            }
            onCancelInvite={(rosterEntryId) => setPendingCancelInviteId(rosterEntryId)}
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

      {/* Rejection reason dialog */}
      {pendingReject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingReject(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Reject student verification</h3>
              <button
                type="button"
                onClick={() => setPendingReject(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Optionally add a reason. It will be visible to your institution's review trail.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="mt-4 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingReject(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={reviewMutation.isPending}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {reviewMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel invite confirmation dialog */}
      {pendingCancelInviteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingCancelInviteId(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Cancel student invite?</h3>
            <p className="mt-2 text-sm text-slate-400">
              The invite email will be invalidated and the roster entry removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingCancelInviteId(null)}>
                Keep invite
              </Button>
              <button
                type="button"
                onClick={() => cancelInviteMutation.mutate(pendingCancelInviteId)}
                disabled={cancelInviteMutation.isPending}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {cancelInviteMutation.isPending ? 'Cancelling...' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
