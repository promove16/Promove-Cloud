import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, GraduationCap, MapPin, Users } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { InstitutionMentorshipProgram } from '../../types/mentorship.types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  createPickerOnlyDateTimeInputHandlers,
  emptyAssignmentDraft,
  formLabelClassName,
  type AssignmentDraft,
} from './mentorshipAdminShared';
import { MentorSearchField } from './MentorSearchField';

const formatDateTimeDisplay = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not provided';

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const getRequestedVenue = (program: InstitutionMentorshipProgram) =>
  program.venue?.trim() ||
  program.institution.location?.trim() ||
  program.institution.locations?.find((location) => location.trim())?.trim() ||
  '';

const getDefaultDraft = (program: InstitutionMentorshipProgram): AssignmentDraft => {
  const requestedVenue = getRequestedVenue(program);
  const deliveryMode = program.deliveryMode;
  const isOnline = deliveryMode === 'Online';

  return {
    ...emptyAssignmentDraft(),
    scheduledAt: toDateTimeLocalValue(program.scheduledAt ?? program.preferredDate),
    deliveryMode,
    platform: isOnline ? (program.platform === 'Offline' ? 'Google Meet' : program.platform) : 'Offline',
    meetingLink: isOnline ? program.meetingLink ?? '' : '',
    venue: isOnline ? '' : requestedVenue,
    adminNotes: program.adminNotes ?? '',
  };
};

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

  const getDraft = (program: InstitutionMentorshipProgram) =>
    assignmentDrafts[program._id] ?? getDefaultDraft(program);
  const updateDraft = (program: InstitutionMentorshipProgram, patch: Partial<AssignmentDraft>) =>
    setAssignmentDrafts((current) => ({
      ...current,
      [program._id]: { ...(current[program._id] ?? getDefaultDraft(program)), ...patch },
    }));

  return (
    <Card className="p-5">
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
            const draft = getDraft(program);
            const requestedVenue = getRequestedVenue(program);
            const requestedSchedule = formatDateTimeDisplay(program.preferredDate);

            return (
              <div
                key={program._id}
                className="rounded-[28px] border border-slate-800 bg-slate-900/95 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.28)]"
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-300">
                          {program.institution.type === 'school' ? 'School request' : 'College request'}
                        </div>
                        <div className="mt-2 font-semibold text-white">{program.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{program.institution.displayName}</div>
                      </div>
                      <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                        Pending
                      </div>
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{program.objective}</p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-200">
                        {program.expectedParticipants} participants
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-200">
                        {program.durationMinutes} min
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-200">
                        {program.deliveryMode} / {program.platform}
                      </span>
                      {program.preferredExpertise ? (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">
                          Expertise: {program.preferredExpertise}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          Requested Date & Time
                        </div>
                        <div className="mt-3 text-sm font-medium text-slate-100">{requestedSchedule}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Auto-filled into the schedule editor. You can change it.
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          <MapPin className="h-3.5 w-3.5" />
                          Requested Venue
                        </div>
                        <div className="mt-3 text-sm font-medium text-slate-100">
                          {program.deliveryMode === 'Online'
                            ? 'Online session'
                            : requestedVenue || 'Venue not specified'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Uses the request venue first, then the institution location if available.
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Requested By
                      </div>
                      <div className="mt-2 text-slate-200">{program.requestedBy.displayName}</div>
                      <div className="mt-1">{program.requestedBy.email}</div>
                      {program.deliveryMode === 'Online' && program.meetingLink ? (
                        <div className="mt-3 break-all text-cyan-200">
                          Meeting link shared in request: {program.meetingLink}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <aside className="rounded-[24px] border border-cyan-500/15 bg-[#07111d] p-3.5">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-300">
                      Assignment Sidebar
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">Schedule session</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Date, time, venue, and delivery mode start from the institution request and remain editable.
                    </p>

                    <div className="mt-4 space-y-2.5">
                      <MentorSearchField
                        mentors={mentors}
                        value={draft.mentorId}
                        onChange={(mentorId) => updateDraft(program, { mentorId })}
                        preferredExpertise={program.preferredExpertise}
                        helperText="Type to filter mentors. Suggestions prefer matching expertise and available capacity."
                      />

                      <div>
                        <label className={formLabelClassName}>Date & Time</label>
                        <input
                          type="datetime-local"
                          value={draft.scheduledAt}
                          onChange={(event) => updateDraft(program, { scheduledAt: event.target.value })}
                          {...createPickerOnlyDateTimeInputHandlers(() => updateDraft(program, { scheduledAt: '' }))}
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <div>
                          <label className={formLabelClassName}>Delivery Mode</label>
                          <select
                            value={draft.deliveryMode}
                            onChange={(event) => {
                              const deliveryMode = event.target.value as AssignmentDraft['deliveryMode'];
                              updateDraft(program, {
                                deliveryMode,
                                platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                                meetingLink: deliveryMode === 'Online' ? draft.meetingLink : '',
                                venue: deliveryMode === 'Offline' ? draft.venue || requestedVenue : '',
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
                              updateDraft(program, {
                                platform: event.target.value as AssignmentDraft['platform'],
                              })
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
                      </div>

                      {draft.deliveryMode === 'Online' ? (
                        <div>
                          <label className={formLabelClassName}>Meeting Link</label>
                          <input
                            value={draft.meetingLink}
                            onChange={(event) => updateDraft(program, { meetingLink: event.target.value })}
                            placeholder="Paste the meeting link"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className={formLabelClassName}>Venue</label>
                          <input
                            value={draft.venue}
                            onChange={(event) => updateDraft(program, { venue: event.target.value })}
                            placeholder="Enter the venue or room"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                          />
                        </div>
                      )}

                      <div>
                        <label className={formLabelClassName}>Admin Notes</label>
                        <textarea
                          value={draft.adminNotes}
                          onChange={(event) => updateDraft(program, { adminNotes: event.target.value })}
                          placeholder="Add scheduling notes or internal context"
                          className="min-h-20 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                          size="sm"
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
                          size="sm"
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
                  </aside>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
