import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ClipboardCheck, KeyRound, Sparkles, UserCheck, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { schoolApi } from '../../api/school.api';
import { MentorshipProgramPanel } from '../institution/MentorshipProgramPanel';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';
import { PatentShowcase } from '../shared/PatentShowcase';
import { ApiErrorResponse } from '../../types/auth.types';
import { BulkCredentialImportResult, TemporaryStudentCredentials } from '../../types/school.types';
import { useAuthStore } from '../../store/authStore';

const statusTone: Record<string, string> = {
  Active: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  'On Track': 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  Pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Inactive: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [tokenLabel, setTokenLabel] = useState('');
  const [latestTemporaryCredential, setLatestTemporaryCredential] = useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] = useState<BulkCredentialImportResult | null>(null);
  const [rosterNotice, setRosterNotice] = useState('');
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
      void queryClient.invalidateQueries({ queryKey: ['school-student-access-tokens'] });
    },
  });
  const createRosterEntryMutation = useMutation({
    mutationFn: schoolApi.createStudentRosterEntry,
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: schoolApi.cancelStudentInvite,
    onSuccess: () => {
      setRosterNotice('Student invite cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['school-student-roster'] });
    },
    onError: (error) => {
      const message =
        isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
          ? error.response.data.error.message
          : 'Unable to cancel this invite.';
      setRosterNotice(message);
      void queryClient.invalidateQueries({ queryKey: ['school-student-roster'] });
    },
  });
  const createTemporaryCredentialMutation = useMutation({
    mutationFn: schoolApi.createTemporaryStudentCredentials,
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['school-student-verifications'] }),
      ]);
    },
  });
  const importRosterWithCredentialsMutation = useMutation({
    mutationFn: schoolApi.importStudentRosterWithCredentials,
    onSuccess: (result) => {
      setBulkCredentialResult(result);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
  });
  const importRosterMutation = useMutation({
    mutationFn: schoolApi.importStudentRoster,
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
      ]);
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ studentId, decision, reason }: { studentId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      schoolApi.reviewStudentVerification(studentId, { decision, reason }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-student-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['school-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['school-students'] }),
      ]);
    },
  });

  const data = dashboardQuery.data;
  const institutionDomainHint = authUser?.email?.split('@')[1];

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
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-cyan-300">School Overview</div>
        <h1 className="text-3xl font-bold text-white">
          {data?.institutionProfile?.institutionName ?? 'School Dashboard'}
        </h1>
        <p className="mt-2 text-slate-400">
          Monitor institutional innovation activity, policy progress, and top student momentum.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Students', value: data?.stats.totalStudents ?? 0, icon: Users },
          { label: 'Innovation Activities', value: data?.stats.totalInnovationActivities ?? 0, icon: Sparkles },
          { label: 'Patents Filed', value: data?.stats.patentsFiled ?? 0, icon: Award },
          { label: 'Startups Launched', value: data?.stats.startupsLaunched ?? 0, icon: ClipboardCheck },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
              <stat.icon className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Patent Activity Summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/10">
              <Award className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-yellow-300">Patent Activity</div>
              <div className="mt-1 text-sm text-slate-400">
                {data?.stats.patentsFiled ?? 0} total patents filed by students
              </div>
            </div>
          </div>
          {data?.recentActivityCounts && (
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-300">+{data.recentActivityCounts.patentsLast30Days}</div>
              <div className="text-xs text-slate-400">Last 30 days</div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
        <Card className="p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">IIC Rating</div>
          <div className="mt-4 text-4xl font-bold text-white">
            {(data?.institutionProfile?.iicStarRating ?? 0).toFixed(1)} / 5.0
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            Current estimated rating for AY {data?.institutionProfile?.academicYear ?? 'current'} based on tracked innovation activity.
          </p>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Policy Compliance</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Current policy breakdown</h2>
            </div>
            <Link to="/dashboard/school/compliance">
              <Button>Download Full Report</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.institutionProfile?.policies ?? []).map((policy) => (
              <div
                key={policy.name}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 md:grid-cols-[1.7fr,140px,140px]"
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

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Upcoming Events</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Read-only institution calendar</h2>
          </div>
        </div>
        <div className="space-y-3">
          {(data?.upcomingEvents ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No upcoming events are scheduled yet.
            </div>
          ) : (
            data?.upcomingEvents.map((event) => (
              <div key={event._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{event.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{event.description}</div>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <div>{new Date(event.scheduledAt).toLocaleDateString('en-IN')}</div>
                    <div>{event.type}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Top Innovators</div>
          <div className="space-y-3">
            {(data?.topStudents ?? []).map((student) => (
              <div key={student._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div>
                  <div className="font-semibold text-white">{student.rank}. {student.displayName}</div>
                  <div className="text-sm text-slate-400">{student.activeProject?.title ?? 'No active workspace'}</div>
                </div>
                <div className="text-lg font-semibold text-cyan-300">{student.innovationScore}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Quick Access</div>
          <div className="space-y-4">
            <Link to="/dashboard/school/students">
              <Button className="w-full justify-between">Open Student Innovators</Button>
            </Link>
            <Link to="/dashboard/school/compliance">
              <Button variant="secondary" className="w-full justify-between">
                Open Compliance Report
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <MentorshipProgramPanel
        queryKey="school-mentorship-programs"
        heading="Request admin-led mentor allocation"
        description="Ask admin to assign a mentor to your school session, confirm online or offline mode, and track approval."
        fetchPrograms={schoolApi.getMentorshipPrograms}
        createProgram={schoolApi.createMentorshipProgram}
      />

      <StudentIntakePanel
        heading="Feed student data manually or from Excel"
        description="Create a school-managed roster, generate temporary credentials for managed student accounts, or issue tokens for self-service student signup."
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
      {rosterNotice ? (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {rosterNotice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student Token Desk</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Issue institution tokens</h2>
              <p className="mt-2 text-sm text-slate-400">
                Students must use one of these shared tokens during public signup. Institution-created temporary credentials are managed from the intake panel.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
              <KeyRound className="h-6 w-6 text-cyan-300" />
            </div>
          </div>

          <form onSubmit={handleCreateToken} className="mb-4 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={tokenLabel}
              onChange={(event) => setTokenLabel(event.target.value)}
              placeholder="Grade 12 innovators"
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <Button type="submit" disabled={createTokenMutation.isPending}>
              {createTokenMutation.isPending ? 'Generating...' : 'Generate Token'}
            </Button>
          </form>

          <div className="space-y-3">
            {(tokenQuery.data ?? []).slice(0, 4).map((token) => (
              <div key={token._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-semibold text-cyan-300">{token.token}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {token.label ?? 'General student onboarding token'}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <div>{token.usageCount} registrations</div>
                    <div>
                      {token.expiresAt
                        ? `Expires ${new Date(token.expiresAt).toLocaleDateString('en-IN')}`
                        : 'No expiry'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(tokenQuery.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                No student tokens issued yet.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Pending Approval</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Review new student signups</h2>
              <p className="mt-2 text-sm text-slate-400">
                Approve students to activate token-based signups. Institution-created temporary accounts are already active.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
              <UserCheck className="h-6 w-6 text-cyan-300" />
            </div>
          </div>

          <div className="space-y-3">
            {(pendingStudentsQuery.data ?? []).map((student) => (
              <div key={student._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{student.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{student.email}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Requested{' '}
                      {new Date(student.verificationRequestedAt ?? student.createdAt).toLocaleString('en-IN')}
                    </div>
                    {student.domain ? (
                      <div className="mt-2 text-sm text-cyan-200">Focus: {student.domain}</div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => reviewMutation.mutate({ studentId: student._id, decision: 'approved' })}
                      disabled={reviewMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleReject(student._id)}
                      disabled={reviewMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {(pendingStudentsQuery.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                No student verifications are waiting right now.
              </div>
            ) : null}
          </div>
        </Card>

        <PatentShowcase />
      </div>
    </div>
  );
}
