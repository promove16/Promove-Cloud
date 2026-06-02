import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { UserRole } from '../../types/roles.types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  createPickerOnlyDateTimeInputHandlers,
  emptyProgramForm,
  formLabelClassName,
  type ProgramFormState,
} from './mentorshipAdminShared';
import { InstitutionSearchField } from './InstitutionSearchField';
import { MentorSearchField } from './MentorSearchField';

const fieldClassName =
  'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/50 focus:bg-slate-950';

function FormSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-slate-800/60 pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">{label}</h3>
        {hint ? <span className="truncate text-[11px] text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function MentorshipProgramCreation() {
  const queryClient = useQueryClient();
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm());
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });
  const schoolsQuery = useQuery({
    queryKey: ['admin-institutions', UserRole.SCHOOL],
    queryFn: () => adminApi.getUsers({ role: UserRole.SCHOOL, limit: 500 }),
  });
  const collegesQuery = useQuery({
    queryKey: ['admin-institutions', UserRole.COLLEGE],
    queryFn: () => adminApi.getUsers({ role: UserRole.COLLEGE, limit: 500 }),
  });

  const createProgramMutation = useMutation({
    mutationFn: adminApi.createMentorshipProgram,
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async () => {
      setProgramForm(emptyProgramForm());
      setFeedback({
        tone: 'success',
        message: 'Mentorship programme created and assigned successfully.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to create the mentorship programme right now.'),
      });
    },
  });

  const mentors = mentorsQuery.data ?? [];
  const schools = schoolsQuery.data?.items ?? [];
  const colleges = collegesQuery.data?.items ?? [];
  const institutionOptions = useMemo(
    () =>
      (programForm.institutionType === 'school' ? schools : colleges).filter((institution) => institution.isActive),
    [colleges, programForm.institutionType, schools],
  );
  const canCreateProgram =
    !createProgramMutation.isPending &&
    mentors.length > 0 &&
    institutionOptions.length > 0 &&
    Boolean(programForm.institutionId) &&
    Boolean(programForm.mentorId);

  const updateProgramForm = (patch: Partial<ProgramFormState>) =>
    setProgramForm((current) => ({ ...current, ...patch }));

  const handleCreateProgram = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProgramMutation.mutate({
      institutionId: programForm.institutionId,
      mentorId: programForm.mentorId,
      title: programForm.title.trim(),
      objective: programForm.objective.trim(),
      preferredDate: new Date(programForm.preferredDate).toISOString(),
      scheduledAt: new Date(programForm.scheduledAt).toISOString(),
      durationMinutes: Number(programForm.durationMinutes),
      expectedParticipants: Number(programForm.expectedParticipants),
      deliveryMode: programForm.deliveryMode,
      platform: programForm.platform,
      ...(programForm.deliveryMode === 'Online' && programForm.meetingLink.trim()
        ? { meetingLink: programForm.meetingLink.trim() }
        : {}),
      ...(programForm.deliveryMode === 'Offline' && programForm.venue.trim()
        ? { venue: programForm.venue.trim() }
        : {}),
      ...(programForm.preferredExpertise.trim()
        ? { preferredExpertise: programForm.preferredExpertise.trim() }
        : {}),
      ...(programForm.adminNotes.trim() ? { adminNotes: programForm.adminNotes.trim() } : {}),
    });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
            Admin Created Programs
          </div>
          <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Create for any school or college</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Build a programme for an institution and assign an available mentor in one step.
          </p>
        </div>

        <Button
          type="submit"
          form="admin-mentorship-program-form"
          disabled={!canCreateProgram}
          className="shrink-0 self-start sm:self-auto"
        >
          {createProgramMutation.isPending ? 'Creating...' : 'Create Programme'}
        </Button>
      </div>

      {feedback ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form id="admin-mentorship-program-form" className="mt-4 space-y-3" onSubmit={handleCreateProgram}>
        <FormSection label="Setup">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={formLabelClassName}>Institution Type</label>
              <select
                value={programForm.institutionType}
                onChange={(event) =>
                  setProgramForm((current) => ({
                    ...current,
                    institutionType: event.target.value as ProgramFormState['institutionType'],
                    institutionId: '',
                  }))
                }
                className={fieldClassName}
              >
                <option value="school">School</option>
                <option value="college">College</option>
              </select>
            </div>
            <div>
              <label className={formLabelClassName}>Programme Title</label>
              <input
                value={programForm.title}
                onChange={(event) => updateProgramForm({ title: event.target.value })}
                placeholder="Enter the programme title"
                className={fieldClassName}
                required
              />
            </div>
            <InstitutionSearchField
              institutions={institutionOptions}
              value={programForm.institutionId}
              onChange={(institutionId) => updateProgramForm({ institutionId })}
              helperText={
                schoolsQuery.isLoading || collegesQuery.isLoading
                  ? 'Loading institutions...'
                  : 'Search by name, location, or email.'
              }
            />
            <MentorSearchField
              mentors={mentors}
              value={programForm.mentorId}
              onChange={(mentorId) => updateProgramForm({ mentorId })}
              preferredExpertise={programForm.preferredExpertise}
              helperText="Suggestions favor matching expertise and lower load."
            />
          </div>
        </FormSection>

        <FormSection label="Schedule & logistics">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className={formLabelClassName}>Preferred Date & Time</label>
              <input
                type="datetime-local"
                value={programForm.preferredDate}
                onChange={(event) => updateProgramForm({ preferredDate: event.target.value })}
                {...createPickerOnlyDateTimeInputHandlers(() => updateProgramForm({ preferredDate: '' }))}
                className={fieldClassName}
                required
              />
            </div>
            <div>
              <label className={formLabelClassName}>Scheduled Date & Time</label>
              <input
                type="datetime-local"
                value={programForm.scheduledAt}
                onChange={(event) => updateProgramForm({ scheduledAt: event.target.value })}
                {...createPickerOnlyDateTimeInputHandlers(() => updateProgramForm({ scheduledAt: '' }))}
                className={fieldClassName}
                required
              />
            </div>
            <div>
              <label className={formLabelClassName}>Duration (Minutes)</label>
              <input
                type="number"
                min={30}
                max={480}
                value={programForm.durationMinutes}
                onChange={(event) => updateProgramForm({ durationMinutes: event.target.value })}
                className={fieldClassName}
                required
              />
            </div>
            <div>
              <label className={formLabelClassName}>Expected Participants</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={programForm.expectedParticipants}
                onChange={(event) => updateProgramForm({ expectedParticipants: event.target.value })}
                className={fieldClassName}
                required
              />
            </div>
            <div>
              <label className={formLabelClassName}>Delivery Mode</label>
              <select
                value={programForm.deliveryMode}
                onChange={(event) => {
                  const deliveryMode = event.target.value as ProgramFormState['deliveryMode'];
                  updateProgramForm({
                    deliveryMode,
                    platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                    meetingLink: deliveryMode === 'Online' ? programForm.meetingLink : '',
                    venue: deliveryMode === 'Offline' ? programForm.venue : '',
                  });
                }}
                className={fieldClassName}
              >
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div>
              <label className={formLabelClassName}>Platform</label>
              <select
                value={programForm.platform}
                onChange={(event) =>
                  updateProgramForm({ platform: event.target.value as ProgramFormState['platform'] })
                }
                className={fieldClassName}
              >
                {programForm.deliveryMode === 'Online' ? (
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
            {programForm.deliveryMode === 'Online' ? (
              <div className="md:col-span-2">
                <label className={formLabelClassName}>Meeting Link</label>
                <input
                  value={programForm.meetingLink}
                  onChange={(event) => updateProgramForm({ meetingLink: event.target.value })}
                  placeholder="Paste the Google Meet, Zoom, or Teams link"
                  className={fieldClassName}
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className={formLabelClassName}>Venue</label>
                <input
                  value={programForm.venue}
                  onChange={(event) => updateProgramForm({ venue: event.target.value })}
                  placeholder="Enter the campus venue or room"
                  className={fieldClassName}
                />
              </div>
            )}
          </div>
        </FormSection>

        <FormSection label="Programme brief">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={formLabelClassName}>Objective</label>
              <textarea
                value={programForm.objective}
                onChange={(event) => updateProgramForm({ objective: event.target.value })}
                placeholder="Describe the objective and expected outcomes"
                className={`${fieldClassName} min-h-20 resize-y`}
                required
              />
            </div>
            <div>
              <label className={formLabelClassName}>Admin Notes</label>
              <textarea
                value={programForm.adminNotes}
                onChange={(event) => updateProgramForm({ adminNotes: event.target.value })}
                placeholder="Add internal notes or logistics context"
                className={`${fieldClassName} min-h-20 resize-y`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={formLabelClassName}>Preferred Expertise</label>
              <input
                value={programForm.preferredExpertise}
                onChange={(event) => updateProgramForm({ preferredExpertise: event.target.value })}
                placeholder="Example: Product strategy, investor readiness"
                className={fieldClassName}
              />
            </div>
          </div>
        </FormSection>
      </form>
    </Card>
  );
}
