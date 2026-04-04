import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, GraduationCap, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgramView,
} from '../../types/mentorship.types';

type FormState = {
  title: string;
  objective: string;
  preferredDate: string;
  durationMinutes: number;
  expectedParticipants: number;
  preferredExpertise: string;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink: string;
  venue: string;
};

const emptyState = (): FormState => ({
  title: '',
  objective: '',
  preferredDate: '',
  durationMinutes: 60,
  expectedParticipants: 50,
  preferredExpertise: '',
  deliveryMode: 'Online',
  platform: 'Google Meet',
  meetingLink: '',
  venue: '',
});

export function MentorshipProgramPanel({
  queryKey,
  heading,
  description,
  fetchPrograms,
  createProgram,
}: {
  queryKey: string;
  heading: string;
  description: string;
  fetchPrograms: () => Promise<InstitutionMentorshipProgramView>;
  createProgram: (payload: CreateInstitutionMentorshipProgramInput) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyState());
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const programsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchPrograms,
  });

  const createMutation = useMutation({
    mutationFn: createProgram,
    onMutate: () => {
      setSubmissionFeedback(null);
    },
    onSuccess: async () => {
      setForm(emptyState());
      setSubmissionFeedback({
        tone: 'success',
        message: 'Mentorship request sent to admin. You can track approval and mentor assignment below.',
      });
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      setSubmissionFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to submit the mentorship request right now.'),
      });
    },
  });

  const programs = programsQuery.data?.items ?? [];
  const stats = programsQuery.data?.stats;

  const latestPrograms = useMemo(() => programs.slice(0, 4), [programs]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createMutation.mutate({
      title: form.title,
      objective: form.objective,
      preferredDate: new Date(form.preferredDate).toISOString(),
      durationMinutes: form.durationMinutes,
      expectedParticipants: form.expectedParticipants,
      ...(form.preferredExpertise.trim() ? { preferredExpertise: form.preferredExpertise.trim() } : {}),
      deliveryMode: form.deliveryMode,
      platform: form.platform,
      ...(form.deliveryMode === 'Online' && form.meetingLink.trim()
        ? { meetingLink: form.meetingLink.trim() }
        : {}),
      ...(form.deliveryMode === 'Offline' && form.venue.trim() ? { venue: form.venue.trim() } : {}),
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr,1fr]">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentorship Requests</div>
            <h2 className="mt-2 text-2xl font-bold text-white">{heading}</h2>
            <p className="mt-2 text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <GraduationCap className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total Requests', value: stats?.total ?? 0, icon: CalendarDays },
            { label: 'Pending', value: stats?.pending ?? 0, icon: GraduationCap },
            { label: 'Assigned', value: stats?.assigned ?? 0, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950">
                <stat.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {programsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              Loading mentorship requests...
            </div>
          ) : latestPrograms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No mentorship requests yet. Submit one to let admin assign a mentor.
            </div>
          ) : (
            latestPrograms.map((program) => (
              <div key={program._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{program.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{program.objective}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Preferred {new Date(program.preferredDate).toLocaleString('en-IN')}
                    </div>
                    {program.scheduledAt ? (
                      <div className="mt-1 text-sm text-cyan-200">
                        Scheduled: {new Date(program.scheduledAt).toLocaleString('en-IN')}
                      </div>
                    ) : null}
                    {program.mentor ? (
                      <div className="mt-1 text-sm text-slate-300">Mentor: {program.mentor.displayName}</div>
                    ) : null}
                    {program.preferredExpertise ? (
                      <div className="mt-1 text-sm text-cyan-200">Preferred expertise: {program.preferredExpertise}</div>
                    ) : null}
                    {program.rejectionReason ? (
                      <div className="mt-2 text-sm text-rose-300">{program.rejectionReason}</div>
                    ) : null}
                  </div>
                  <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                    {program.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Request To Admin</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Submit a mentorship request</h2>
        <p className="mt-2 text-sm text-slate-400">
          Admin will review the request, approve it, and assign an available mentor without schedule conflicts.
        </p>
        {submissionFeedback ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              submissionFeedback.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {submissionFeedback.message}
          </div>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Program title"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            required
          />
          <textarea
            value={form.objective}
            onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
            placeholder="Program objective and expected outcomes"
            className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            required
          />
          <input
            value={form.preferredExpertise}
            onChange={(event) => setForm((current) => ({ ...current, preferredExpertise: event.target.value }))}
            placeholder="Preferred mentor expertise"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="datetime-local"
              value={form.preferredDate}
              onChange={(event) => setForm((current) => ({ ...current, preferredDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <input
              type="number"
              min={30}
              max={480}
              value={form.durationMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) || 60 }))
              }
              placeholder="Duration in minutes"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="number"
              min={1}
              value={form.expectedParticipants}
              onChange={(event) =>
                setForm((current) => ({ ...current, expectedParticipants: Number(event.target.value) || 1 }))
              }
              placeholder="Expected participants"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <select
              value={form.deliveryMode}
              onChange={(event) => {
                const deliveryMode = event.target.value as FormState['deliveryMode'];
                setForm((current) => ({
                  ...current,
                  deliveryMode,
                  platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                  meetingLink: deliveryMode === 'Online' ? current.meetingLink : '',
                  venue: deliveryMode === 'Offline' ? current.venue : '',
                }));
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
          <select
            value={form.platform}
            onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as FormState['platform'] }))}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          >
            {form.deliveryMode === 'Online' ? (
              <>
                <option value="Google Meet">Google Meet</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="Zoom">Zoom</option>
              </>
            ) : (
              <option value="Offline">Offline</option>
            )}
          </select>
          {form.deliveryMode === 'Online' ? (
            <input
              value={form.meetingLink}
              onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))}
              placeholder="Meeting link (optional)"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          ) : (
            <input
              value={form.venue}
              onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))}
              placeholder="Venue / campus location"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          )}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Submit Mentorship Request'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
