import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Users, X } from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { ApiErrorResponse } from '../../types/auth.types';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';
import { DashboardMetricRail } from '../institution/dashboardSurface';
import { StudentAccessWorkspace } from '../institution/StudentAccessWorkspace';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) &&
    error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export default function OperationsPage() {
  const queryClient = useQueryClient();
  const [tokenLabel, setTokenLabel] = useState('');

  // Inline rejection dialog state
  const [pendingReject, setPendingReject] = useState<{ studentId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
      icon: Users,
    },
    {
      label: 'Approval Queue',
      value: pendingCount,
      icon: ShieldCheck,
    },
    {
      label: 'Access Tokens',
      value: tokenCount,
      icon: KeyRound,
    },
    {
      label: 'Roster',
      value: rosterCount,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="College Operations"
        title={institutionName}
        showMenu={false}
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

    </div>
  );
}
