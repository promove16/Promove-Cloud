import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CalendarDays,
  KeyRound,
  Rocket,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { collegeApi } from '../../api/college.api';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [tokenLabel, setTokenLabel] = useState('');
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
  const importRosterMutation = useMutation({
    mutationFn: collegeApi.importStudentRoster,
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
      ]);
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ studentId, decision, reason }: { studentId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      collegeApi.reviewStudentVerification(studentId, { decision, reason }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-student-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['college-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['college-students'] }),
      ]);
    },
  });

  const data = dashboardQuery.data;

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
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-cyan-300">College Overview</div>
        <h1 className="text-3xl font-bold text-white">
          {data?.institutionProfile?.institutionName ?? 'College Dashboard'}
        </h1>
        <p className="mt-2 text-slate-400">
          Track innovation performance, hiring movement, and event momentum in one place.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {[
          { label: 'Total Students', value: data?.stats.totalStudents ?? 0, icon: Users },
          { label: 'Innovation Activities', value: data?.stats.totalInnovationActivities ?? 0, icon: Sparkles },
          { label: 'Patents Filed', value: data?.stats.patentsFiled ?? 0, icon: Rocket },
          { label: 'Startups Launched', value: data?.stats.startupsLaunched ?? 0, icon: Rocket },
          { label: 'Students Placed', value: data?.stats.studentsPlaced ?? 0, icon: BriefcaseBusiness },
          { label: 'Active HR Partners', value: data?.stats.activeHRPartners ?? 0, icon: CalendarDays },
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

      <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
        <Card className="p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">IIC Rating</div>
          <div className="mt-4 text-4xl font-bold text-white">
            {(data?.institutionProfile?.iicStarRating ?? 0).toFixed(1)} / 5.0
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            Current estimated rating for AY {data?.institutionProfile?.academicYear ?? 'current'}.
          </p>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Policy Compliance</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Current policy breakdown</h2>
            </div>
            <Link to="/dashboard/college/compliance">
              <Button>Download Full Report</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.institutionProfile?.policies ?? []).map((policy) => (
              <div key={policy.name} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{policy.name}</div>
                  <div className="text-sm text-slate-400">{policy.status}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Placement Velocity</div>
        <div className="mt-4 text-4xl font-bold text-white">{data?.stats.placementVelocity ?? 0}%</div>
        <p className="mt-3 text-sm text-slate-400">Of student innovators placed this year.</p>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Recent Events</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Latest institution events</h2>
          </div>
          <Link to="/dashboard/college/events">
            <Button>Create Event</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {(data?.upcomingEvents ?? []).map((event) => (
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
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Link to="/dashboard/college/placement">
          <Card className="p-6">
            <div className="text-xl font-semibold text-white">Open Placement Tracker</div>
            <div className="mt-2 text-sm text-slate-400">Review recruiter-driven placement progress.</div>
          </Card>
        </Link>
        <Link to="/dashboard/college/students">
          <Card className="p-6">
            <div className="text-xl font-semibold text-white">Open Student Innovators</div>
            <div className="mt-2 text-sm text-slate-400">See the latest leaderboard movement.</div>
          </Card>
        </Link>
      </div>

      <StudentIntakePanel
        heading="Feed student intake data for your college"
        description="Build a managed student roster from manual entries or Excel-compatible files, then let students register using their institution email before you verify them."
        secondaryFieldLabel="Program / Year"
        secondaryFieldPlaceholder="B.Tech CSE - 3rd Year"
        roster={rosterQuery.data ?? []}
        isRosterLoading={rosterQuery.isLoading}
        isManualSubmitting={createRosterEntryMutation.isPending}
        isImportSubmitting={importRosterMutation.isPending}
        onCreateManualEntry={(payload) => createRosterEntryMutation.mutate(payload)}
        onImportFile={(file) => importRosterMutation.mutate(file)}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student Token Desk</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Issue college verification tokens</h2>
              <p className="mt-2 text-sm text-slate-400">
                Students can register either with a shared token or with an institution email already present in your roster feed.
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
              placeholder="2026 incubator cohort"
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
                      {token.label ?? 'General college onboarding token'}
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
              <h2 className="mt-2 text-xl font-semibold text-white">Review student registrations</h2>
              <p className="mt-2 text-sm text-slate-400">
                Only approved students get access to the platform and show up in your live college metrics, whether they entered through token signup or roster-based onboarding.
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
      </div>
    </div>
  );
}
