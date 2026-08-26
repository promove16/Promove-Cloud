import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ChevronDown, ChevronUp, Mail, ShieldCheck, Sparkles, X } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../utils/apiError';

type Props = {
  studentId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onInviteToJob?: (studentId: string) => void;
  activeJobCount?: number;
};

const scoreFields = [
  ['Problems Solved', 'problemsCompleted'],
  ['Skills Completed', 'skillsCompleted'],
  ['Progress Uploads', 'progressUploads'],
  ['Patents Filed', 'patentsSubmitted'],
  ['Patents Approved', 'patentsApproved'],
  ['MVPs Verified', 'mvpsVerified'],
  ['Market Ready', 'marketReadyVerified'],
  ['Startups Launched', 'startupsLaunched'],
] as const;

export function StudentProfileDrawer({
  studentId,
  open,
  onClose,
  onChanged,
  onInviteToJob,
  activeJobCount = 0,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAllJourney, setShowAllJourney] = useState(false);
  const profileQuery = useQuery({
    queryKey: ['recruiter', 'student-profile', studentId],
    queryFn: () => recruiterApi.getTalentProfile(studentId!),
    enabled: open && Boolean(studentId),
  });

  const shortlistMutation = useMutation({
    mutationFn: (targetStudentId: string) => recruiterApi.shortlistStudent(targetStudentId),
    onSuccess: async (_, targetStudentId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'student-profile', targetStudentId] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'talent'] }),
      ]);
      toast.success('Candidate shortlisted and connected!');
      onChanged?.();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to shortlist this candidate.'));
    },
  });

  if (!open) {
    return null;
  }

  const profile = profileQuery.data;
  const profileSkills = profile?.skills ?? [];
  const scoreTimeline = profile?.scoreTimeline ?? [];
  const workspaces = profile?.workspaces ?? [];
  const patents = profile?.patents ?? [];
  const startups = profile?.startups ?? [];

  const INITIAL_JOURNEY_COUNT = 4;
  const displayedTimeline = showAllJourney ? scoreTimeline : scoreTimeline.slice(0, INITIAL_JOURNEY_COUNT);

  const handleMessage = () => {
    if (!studentId) return;
    navigate(`/dashboard/messages/${studentId}`);
  };

  const handleShortlist = () => {
    if (!studentId || shortlistMutation.isPending) return;
    shortlistMutation.mutate(studentId);
  };

  const handleInvite = () => {
    if (!studentId || !onInviteToJob) return;
    onInviteToJob(studentId);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button type="button" aria-label="Close student profile" className="flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl shadow-black/80">
        {profileQuery.isLoading || !profile ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800/80 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-xl font-bold text-white shadow-lg">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.displayName}
                      className="h-16 w-16 rounded-3xl object-cover"
                    />
                  ) : (
                    profile.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
                    {profile.canContact ? <Badge>Can contact</Badge> : <Badge className="border-slate-700 bg-slate-800 text-slate-300">Locked</Badge>}
                  </div>
                  <p className="mt-1 text-slate-400">
                    {profile.institution?.name ?? 'Independent'} - {profileSkills.join(' - ') || 'General innovation'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <Sparkles className="h-4 w-4" />
                  Score Breakdown
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {scoreFields.map(([label, key]) => (
                    <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {profile.scoreBreakdown[key]}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Journey</div>
                      {scoreTimeline.length > 0 && (
                        <span className="text-xs font-medium text-slate-500">{scoreTimeline.length} total</span>
                      )}
                    </div>
                    {scoreTimeline.length > 0 ? (
                      <div className="divide-y divide-slate-800/60 space-y-1">
                        {displayedTimeline.map((event) => (
                          <div key={event._id} className="flex items-center justify-between py-2.5 px-2 rounded-xl transition-colors hover:bg-slate-900/50">
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="text-sm font-semibold uppercase text-white tracking-wide">
                                {event.trigger.replace(/_/g, ' ')}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {new Date(event.createdAt).toLocaleString('en-IN')}
                              </div>
                            </div>
                            <span className="flex-none rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                              +{event.delta}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-sm text-slate-400">No activity history yet.</div>
                    )}
                  </div>

                  {scoreTimeline.length > INITIAL_JOURNEY_COUNT && (
                    <button
                      type="button"
                      onClick={() => setShowAllJourney((prev) => !prev)}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 text-xs font-semibold text-cyan-400 transition hover:bg-slate-800 hover:text-cyan-300"
                    >
                      {showAllJourney ? (
                        <>
                          <span>Show Less</span>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Read More ({scoreTimeline.length - INITIAL_JOURNEY_COUNT} more)</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="mb-3 text-sm uppercase tracking-[0.25em] text-slate-500">Current Stage</div>
                  {profile.activeProject ? (
                    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                      <div className="font-semibold text-white">{profile.activeProject.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{profile.activeProject.category}</div>
                      <div className="mt-4 h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                          style={{ width: `${Math.min(profile.activeProject.progressPercent, 100)}%` }}
                        />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">{profile.activeProject.stage}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No active workspace attached.</div>
                  )}
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-3 text-sm uppercase tracking-[0.25em] text-slate-500">Workspaces</div>
                  <div className="space-y-3">
                    {workspaces.length > 0 ? (
                      workspaces.map((workspace) => (
                        <div key={workspace._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="font-semibold text-white">{workspace.title}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {workspace.category} - {workspace.stage}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-400">No workspaces yet.</div>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-3 text-sm uppercase tracking-[0.25em] text-slate-500">Patents and Startups</div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Patents</div>
                      <div className="space-y-2">
                        {patents.length > 0 ? (
                          patents.map((patent) => (
                            <div key={patent._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                              <div className="font-semibold text-white">{patent.projectTitle}</div>
                              <div className="mt-1 text-sm text-slate-400">{patent.status}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-400">No patents filed yet.</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Startups</div>
                      <div className="space-y-2">
                        {startups.length > 0 ? (
                          startups.map((startup) => (
                            <div key={startup._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                              <div className="font-semibold text-white">{startup.name}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {startup.category} - {startup.stage}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-400">No startups launched yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Footer actions bar — shifted to left side */}
            <div className="flex shrink-0 flex-wrap items-center justify-start gap-3 border-t border-slate-800 bg-slate-950 px-6 py-4 pr-20">
              <Button
                data-testid="message-btn"
                onClick={handleMessage}
                disabled={!profile.canContact}
                variant="primary"
              >
                <Mail className="mr-2 h-4 w-4" />
                Message
              </Button>
              {onInviteToJob ? (
                <Button
                  data-testid="invite-job-btn"
                  onClick={handleInvite}
                  variant="secondary"
                  title={
                    activeJobCount > 0
                      ? undefined
                      : 'No active jobs yet. Open the invite flow to create or reopen one.'
                  }
                >
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Invite to Job
                </Button>
              ) : null}
              {!profile.canContact ? (
                <Button
                  data-testid="shortlist-btn"
                  onClick={handleShortlist}
                  disabled={shortlistMutation.isPending}
                  variant="secondary"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {shortlistMutation.isPending ? 'Shortlisting...' : 'Shortlist to Connect'}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={onClose} className="px-5">
                Close
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
