import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, Rocket, Shield, X, type LucideIcon } from 'lucide-react';
import { mentorApi } from '../../api/mentor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { MAX_INNOVATION_SCORE } from '../../constants/score';

type Props = {
  open: boolean;
  studentId: string | null;
  onClose: () => void;
  onSchedule: (studentId: string) => void;
};

const metricCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
  { label: 'Problems Solved', value: 0, icon: FileText },
  { label: 'Innovations Created', value: 0, icon: Shield },
  { label: 'Prototypes Built', value: 0, icon: Rocket },
  { label: 'Patents Filed', value: 0, icon: FileText },
  { label: 'Startups Launched', value: 0, icon: Rocket },
];

export function StudentProfileDrawer({ open, studentId, onClose, onSchedule }: Props) {
  const profileQuery = useQuery({
    queryKey: ['mentor-student-profile', studentId],
    queryFn: () => mentorApi.getStudent(studentId!),
    enabled: open && Boolean(studentId),
  });
  const [feedback, setFeedback] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: () =>
      mentorApi.submitFeedback(studentId!, {
        feedbackText: feedback,
        rating: 4,
      }),
    onSuccess: () => {
      setFeedback('');
      setStatusMessage('Feedback sent to the student.');
    },
    onError: () => {
      setStatusMessage('Unable to send feedback right now.');
    },
  });

  useEffect(() => {
    setFeedback('');
    setStatusMessage(null);
  }, [studentId]);

  if (!open || !studentId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950 backdrop-blur-sm">
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student Profile</div>
            <h2 className="mt-2 text-3xl font-bold text-white">Portfolio</h2>
          </div>
          <Button variant="ghost" className="rounded-full p-3" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {profileQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : profileQuery.data ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-2xl font-bold text-white">
                    {profileQuery.data.student.avatar ? (
                      <img
                        src={profileQuery.data.student.avatar}
                        alt={profileQuery.data.student.displayName}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      profileQuery.data.student.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{profileQuery.data.student.displayName}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>{profileQuery.data.student.innovationScore}/{MAX_INNOVATION_SCORE}</Badge>
                      {profileQuery.data.student.domain ? <Badge>{profileQuery.data.student.domain}</Badge> : null}
                      {profileQuery.data.student.institutionName ? <Badge>{profileQuery.data.student.institutionName}</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => onSchedule(studentId)}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Schedule Session
                  </Button>
                </div>
              </div>
              {profileQuery.data.student.bio ? <p className="mt-4 leading-7 text-slate-300">{profileQuery.data.student.bio}</p> : null}
            </Card>

            <div className="grid gap-4 md:grid-cols-5">
              {metricCards.map((metric) => {
                const value =
                  metric.label === 'Problems Solved'
                    ? profileQuery.data.student.scoreBreakdown.problemsClaimed
                    : metric.label === 'Innovations Created'
                      ? profileQuery.data.student.scoreBreakdown.skillsCompleted
                      : metric.label === 'Prototypes Built'
                        ? profileQuery.data.student.scoreBreakdown.progressUploads
                        : metric.label === 'Patents Filed'
                          ? profileQuery.data.student.scoreBreakdown.patentsSubmitted
                          : profileQuery.data.student.scoreBreakdown.startupsLaunched;

                return (
                  <Card key={metric.label} className="p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                      <metric.icon className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="mt-1 text-xs text-slate-400">{metric.label}</div>
                  </Card>
                );
              })}
            </div>

            <Card className="p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Innovation Journey</div>
              <div className="grid gap-3 md:grid-cols-5">
                {['Idea', 'Problem', 'Build', 'Patent', 'Launch'].map((stage) => (
                  <div key={stage} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-4 text-center text-cyan-200">
                    {stage}
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-6">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Workspaces</div>
                <div className="space-y-3">
                  {profileQuery.data.workspaces.length === 0 ? (
                    <div className="text-sm text-slate-500">No workspaces available.</div>
                  ) : (
                    profileQuery.data.workspaces.map((workspace) => (
                      <div key={workspace._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{workspace.title}</div>
                            <div className="mt-1 text-sm text-slate-400">{workspace.category}</div>
                          </div>
                          <Badge>{workspace.stage}</Badge>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-800">
                          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${workspace.progressPercent}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Timeline</div>
                <div className="space-y-3">
                  {profileQuery.data.scoreEvents.length === 0 ? (
                    <div className="text-sm text-slate-500">No score events yet.</div>
                  ) : (
                    profileQuery.data.scoreEvents.map((event) => (
                      <div key={event._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-white">{event.trigger.replace(/_/g, ' ')}</div>
                          <Badge>+{event.delta}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-slate-400">{new Date(event.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-6">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Patents</div>
                <div className="space-y-3">
                  {profileQuery.data.patents.length === 0 ? (
                    <div className="text-sm text-slate-500">No patents yet.</div>
                  ) : (
                    profileQuery.data.patents.map((patent) => (
                      <div key={patent._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="font-semibold text-white">{patent.projectTitle}</div>
                        <div className="mt-2 text-sm text-slate-400">{patent.status}</div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Startups</div>
                <div className="space-y-3">
                  {profileQuery.data.startups.length === 0 ? (
                    <div className="text-sm text-slate-500">No startups yet.</div>
                  ) : (
                    profileQuery.data.startups.map((startup) => (
                      <div key={startup._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="font-semibold text-white">{startup.name}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge>{startup.category}</Badge>
                          <Badge>{startup.stage}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Give Feedback</div>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Add private feedback for this student"
                className="min-h-32 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  {statusMessage ?? 'Share concise, actionable written feedback with the student.'}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => feedbackMutation.mutate()}
                  disabled={feedback.trim().length < 10 || feedbackMutation.isPending}
                >
                  Send Feedback
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
