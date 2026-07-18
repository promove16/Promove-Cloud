import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { toast } from '../../components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { ApiErrorResponse } from '../../types/auth.types';
import { TemporaryStudentCredentials } from '../../types/college.types';
import { BulkCredentialImportResult } from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';
import { InstitutionAccessTokenDialog } from '../institution/InstitutionAccessTokenDialog';
import { InstitutionApprovalQueuePanel } from '../institution/InstitutionApprovalQueuePanel';
import { LeaderboardPageBase } from '../institution/LeaderboardPageBase';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export default function StudentLeaderboard() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const rosterQuery = useQuery({
    queryKey: ['college-student-roster'],
    queryFn: () => collegeApi.getStudentRoster(),
  });
  const pendingStudentsQuery = useQuery({
    queryKey: ['college-student-verifications'],
    queryFn: collegeApi.getPendingStudentVerifications,
  });
  const institutionDomainHint = authUser?.email?.split('@')[1];
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [rejectingStudentId, setRejectingStudentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] =
    useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] =
    useState<BulkCredentialImportResult | null>(null);

  const createRosterEntryMutation = useMutation({
    mutationFn: collegeApi.createStudentRosterEntry,
    onSuccess: (entry) => {
      toast.success(
        entry.status === 'invited' && !entry.linkedUserId
          ? 'Student invite saved. Registration email sent.'
          : 'Student roster entry saved.',
      );
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to add this student right now.'));
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: collegeApi.cancelStudentInvite,
    onSuccess: () => {
      toast.success('Student invite cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to cancel this invite.'));
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
    },
  });

  const createTemporaryCredentialMutation = useMutation({
    mutationFn: collegeApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['institution-leaderboard', 'college'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to create the temporary login right now.'));
    },
  });

  const importRosterMutation = useMutation({
    mutationFn: collegeApi.importStudentRoster,
    onSuccess: () => {
      toast.success('Roster import complete.');
      void queryClient.invalidateQueries({ queryKey: ['college-student-roster'] });
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
        queryClient.invalidateQueries({ queryKey: ['institution-leaderboard', 'college'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to import the roster with credentials.'));
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
    onSuccess: (_result, variables) => {
      toast.success(
        variables.decision === 'approved'
          ? 'Student approved.'
          : 'Student rejected.',
      );
      setRejectingStudentId(null);
      setRejectReason('');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['institution-leaderboard', 'college'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to review this student right now.'));
    },
  });

  return (
    <LeaderboardPageBase
      mode="college"
      title="Student Innovators"
      subtitle="Ranked by Innovation Score"
      basePath="/dashboard/college"
      fetchPage={(cursor) => collegeApi.getStudents(cursor)}
      fetchJourney={collegeApi.getStudentJourney}
      headerAction={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-white"
            onClick={() => setIsTokenDialogOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Tokens
          </Button>
          <StudentIntakePanel
            heading="Feed student intake data for your college"
            description="Build a managed roster and email invites automatically."
            secondaryFieldLabel="Program / Year"
            secondaryFieldPlaceholder="B.Tech CSE - 3rd Year"
            compactTrigger
            triggerLabel="Manage Students"
            showContextNote={false}
            roster={rosterQuery.data ?? []}
            institutionDomainHint={institutionDomainHint}
            isRosterLoading={rosterQuery.isLoading}
            isManualSubmitting={createRosterEntryMutation.isPending}
            isImportSubmitting={importRosterMutation.isPending}
            isImportWithCredentialsSubmitting={importRosterWithCredentialsMutation.isPending}
            isTemporaryCredentialSubmitting={createTemporaryCredentialMutation.isPending}
            temporaryCredential={latestTemporaryCredential}
            bulkCredentialResult={bulkCredentialResult}
            onCreateManualEntry={(payload) => createRosterEntryMutation.mutateAsync(payload)}
            onCancelInvite={(rosterEntryId) => cancelInviteMutation.mutate(rosterEntryId)}
            cancellingInviteId={cancelInviteMutation.isPending ? cancelInviteMutation.variables : null}
            onImportFile={(file) => importRosterMutation.mutate(file)}
            onImportFileWithCredentials={(file) => importRosterWithCredentialsMutation.mutate(file)}
            onCreateTemporaryCredentials={(payload) =>
              createTemporaryCredentialMutation.mutate(payload)
            }
          />
          <InstitutionAccessTokenDialog
            open={isTokenDialogOpen}
            onOpenChange={setIsTokenDialogOpen}
            mode="college"
            title="College Access Tokens"
            description="Issue a token and share it with students who need to register against your college."
            tokenPlaceholder="2026 placement cohort"
            fallbackLabel="General college onboarding token"
            queryKeyPrefix="college"
            fetchTokens={collegeApi.getStudentAccessTokens}
            createToken={collegeApi.createStudentAccessToken}
          />
        </div>
      }
      sidePanel={
        <InstitutionApprovalQueuePanel
          pendingStudents={pendingStudentsQuery.data ?? []}
          isLoading={pendingStudentsQuery.isLoading}
          isReviewing={reviewMutation.isPending}
          rejectingStudentId={rejectingStudentId}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onBeginReject={(studentId) => {
            setRejectingStudentId(studentId);
            setRejectReason('');
          }}
          onCancelReject={() => {
            setRejectingStudentId(null);
            setRejectReason('');
          }}
          onApprove={(studentId) =>
            reviewMutation.mutate({ studentId, decision: 'approved' })
          }
          onConfirmReject={(studentId) =>
            reviewMutation.mutate({
              studentId,
              decision: 'rejected',
              ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
            })
          }
        />
      }
    />
  );
}
