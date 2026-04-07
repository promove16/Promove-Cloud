import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Mail, ShieldCheck, Sparkles, X } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

type Props = {
  studentId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onInviteToJob?: (studentId: string) => void;
  activeJobCount?: number;
};

const scoreFields = [
  ['Problems Solved', 'problemsClaimed'],
  ['Skills Completed', 'skillsCompleted'],
  ['Progress Uploads', 'progressUploads'],
  ['Patents Filed', 'patentsSubmitted'],
  ['Patents Approved', 'patentsApproved'],
  ['MVPs Verified', 'mvpsVerified'],
  ['Market Ready', 'marketReadyVerified'],
  ['Startups Launched', 'startupsLaunched'],
  ['Awards Approved', 'awardsApproved'],
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
  const profileQuery = useQuery({
    queryKey: ['recruiter', 'student-profile', studentId],
    queryFn: () => recruiterApi.getTalentProfile(studentId!),
    enabled: open && Boolean(studentId),
  });

  if (!open) {
    return null;
  }

  const profile = profileQuery.data;

  const handleMessage = () => {
    if (!studentId) return;
    navigate(`/dashboard/recruiter/messages/${studentId}`);
  };

  const handleShortlist = async () => {
    if (!studentId) return;
    await recruiterApi.shortlistStudent(studentId);
    onChanged?.();
  };

  const handleInvite = () => {
    if (!studentId || !onInviteToJob) return;
    onInviteToJob(studentId);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button type="button" aria-label="Close student profile" className="flex-1" onClick={onClose} />
      <aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 shadow-2xl shadow-black/40">
        {profileQuery.isLoading || !profile ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-xl font-bold text-white">
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
                    {profile.institution?.name ?? 'Independent'} - {profile.skills.join(' - ') || 'General innovation'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

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
              <Card className="p-5">
                <div className="mb-3 text-sm uppercase tracking-[0.25em] text-slate-500">Journey</div>
                <div className="space-y-3">
                  {profile.scoreTimeline.length > 0 ? (
                    profile.scoreTimeline.map((event) => (
                      <div key={event._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-white">{event.trigger.replace(/_/g, ' ')}</div>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            +{event.delta}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                          {new Date(event.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">No activity history yet.</div>
                  )}
                </div>
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
                  {profile.workspaces.length > 0 ? (
                    profile.workspaces.map((workspace) => (
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
                      {profile.patents.length > 0 ? (
                        profile.patents.map((patent) => (
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
                      {profile.startups.length > 0 ? (
                        profile.startups.map((startup) => (
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

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
              {onInviteToJob ? (
                <Button data-testid="invite-job-btn" onClick={handleInvite}>
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  {activeJobCount > 0 ? 'Invite to Job' : 'Create job to invite'}
                </Button>
              ) : null}
              {profile.canContact ? (
                <Button data-testid="message-btn" onClick={handleMessage} variant={onInviteToJob ? 'secondary' : 'primary'}>
                  <Mail className="mr-2 h-4 w-4" />
                  Message
                </Button>
              ) : (
                <Button data-testid="shortlist-btn" onClick={handleShortlist} variant={onInviteToJob ? 'secondary' : 'primary'}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Shortlist to Connect
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
