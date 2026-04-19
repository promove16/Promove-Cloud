import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, GraduationCap, Users } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  createPickerOnlyDateTimeInputHandlers,
  emptyAssignmentDraft,
  formLabelClassName,
  type AssignmentDraft,
} from './mentorshipAdminShared';

export default function MentorshipRequests() {
  const queryClient = useQueryClient();
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const programsQuery = useQuery({
    queryKey: ['admin-mentorship-programs'],
    queryFn: () => adminApi.getMentorshipPrograms(),
  });
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof adminApi.reviewMentorshipProgram>[1];
    }) => adminApi.reviewMentorshipProgram(id, payload),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async () => {
      setFeedback({
        tone: 'success',
        message: 'Mentorship request reviewed successfully.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to review the mentorship request right now.'),
      });
    },
  });

  const pendingPrograms = useMemo(
    () => (programsQuery.data?.items ?? []).filter((item) => item.status === 'Pending'),
    [programsQuery.data?.items],
  );
  const mentors = mentorsQuery.data ?? [];

  const getDraft = (id: string) => assignmentDrafts[id] ?? emptyAssignmentDraft();
  const updateDraft = (id: string, patch: Partial<AssignmentDraft>) =>
    setAssignmentDrafts((current) => ({
      ...current,
      [id]: { ...getDraft(id), ...patch },
    }));

  return (
    <Card className="p-6">
      <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Institution Mentorship Requests</div>
      <h2 className="mt-2 text-2xl font-bold text-white">Pending institution requests</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total', value: programsQuery.data?.stats.total ?? 0, icon: CalendarDays },
          { label: 'Pending', value: programsQuery.data?.stats.pending ?? 0, icon: GraduationCap },
          { label: 'Assigned', value: programsQuery.data?.stats.assigned ?? 0, icon: Users },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950">
              <stat.icon className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {feedback ? (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {programsQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            Loading requests...
          </div>
        ) : pendingPrograms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            No pending mentorship requests.
          </div>
        ) : (
          pendingPrograms.map((program) => {
            const draft = getDraft(program._id);
            return (
              <div key={program._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{program.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{program.institution.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{program.objective}</div>
                    {program.preferredExpertise ? (
                      <div className="mt-2 text-sm text-cyan-200">Preferred expertise: {program.preferredExpertise}</div>
                    ) : null}
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Preferred {new Date(program.preferredDate).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                    Pending
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className={formLabelClassName}>Assigned Mentor</label>
                    <select
                      value={draft.mentorId}
                      onChange={(event) => updateDraft(program._id, { mentorId: event.target.value })}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="">Select mentor</option>
                      {mentors.map((mentor) => (
                        <option key={mentor._id} value={mentor._id}>
                          {mentor.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={formLabelClassName}>Scheduled Date & Time</label>
                    <input
                      type="datetime-local"
                      value={draft.scheduledAt}
                      onChange={(event) => updateDraft(program._id, { scheduledAt: event.target.value })}
                      {...createPickerOnlyDateTimeInputHandlers(() =>
                        updateDraft(program._id, { scheduledAt: '' }),
                      )}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    />
                  </div>
                  <div>
                    <label className={formLabelClassName}>Delivery Mode</label>
                    <select
                      value={draft.deliveryMode}
                      onChange={(event) => {
                        const deliveryMode = event.target.value as AssignmentDraft['deliveryMode'];
                        updateDraft(program._id, {
                          deliveryMode,
                          platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                          meetingLink: deliveryMode === 'Online' ? draft.meetingLink : '',
                          venue: deliveryMode === 'Offline' ? draft.venue : '',
                        });
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                  <div>
                    <label className={formLabelClassName}>Platform</label>
                    <select
                      value={draft.platform}
                      onChange={(event) =>
                        updateDraft(program._id, { platform: event.target.value as AssignmentDraft['platform'] })
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    >
                      {draft.deliveryMode === 'Online' ? (
                        <>
                          <option value="Google Meet">Google Meet</option>
                          <option value="Microsoft Teams">Microsoft Teams</option>
                          <option value="Zoom">Zoom</option>
                        </>
                      ) : (
                        <option value="Offline">Offline</option>
                      )}
                    </select>
                  </div>
                  {draft.deliveryMode === 'Online' ? (
                    <div className="md:col-span-2">
                      <label className={formLabelClassName}>Meeting Link</label>
                      <input
                        value={draft.meetingLink}
                        onChange={(event) => updateDraft(program._id, { meetingLink: event.target.value })}
                        placeholder="Paste the meeting link"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2">
                      <label className={formLabelClassName}>Venue</label>
                      <input
                        value={draft.venue}
                        onChange={(event) => updateDraft(program._id, { venue: event.target.value })}
                        placeholder="Enter the venue or room"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className={formLabelClassName}>Admin Notes</label>
                    <textarea
                      value={draft.adminNotes}
                      onChange={(event) => updateDraft(program._id, { adminNotes: event.target.value })}
                      placeholder="Add scheduling notes or internal context"
                      className="min-h-24 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      reviewMutation.mutate({
                        id: program._id,
                        payload: {
                          decision: 'assigned',
                          mentorId: draft.mentorId,
                          scheduledAt: new Date(draft.scheduledAt).toISOString(),
                          deliveryMode: draft.deliveryMode,
                          platform: draft.platform,
                          ...(draft.deliveryMode === 'Online' && draft.meetingLink.trim()
                            ? { meetingLink: draft.meetingLink.trim() }
                            : {}),
                          ...(draft.deliveryMode === 'Offline' && draft.venue.trim()
                            ? { venue: draft.venue.trim() }
                            : {}),
                          ...(draft.adminNotes.trim() ? { adminNotes: draft.adminNotes.trim() } : {}),
                        },
                      })
                    }
                    disabled={reviewMutation.isPending || !draft.mentorId || !draft.scheduledAt}
                  >
                    Assign Mentor
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const rejectionReason = window.prompt('Enter rejection reason')?.trim();
                      if (!rejectionReason) return;
                      reviewMutation.mutate({
                        id: program._id,
                        payload: {
                          decision: 'rejected',
                          rejectionReason,
                          ...(draft.adminNotes.trim() ? { adminNotes: draft.adminNotes.trim() } : {}),
                        },
                      });
                    }}
                    disabled={reviewMutation.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
