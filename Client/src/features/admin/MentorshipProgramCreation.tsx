import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { UserRole } from '../../types/roles.types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  emptyProgramForm,
  formLabelClassName,
  getInstitutionLabel,
  type ProgramFormState,
} from './mentorshipAdminShared';

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
    <Card className="p-6">
      <div className="max-w-4xl">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admin Created Programs</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Create for any school or college</h2>
        <p className="mt-2 text-sm text-slate-400">
          Build a mentorship programme on behalf of an institution and assign an available mentor in the same step.
        </p>
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

      <form className="mt-6 space-y-4" onSubmit={handleCreateProgram}>
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="school">School</option>
              <option value="college">College</option>
            </select>
          </div>
          <div>
            <label className={formLabelClassName}>Institution</label>
            <select
              value={programForm.institutionId}
              onChange={(event) => updateProgramForm({ institutionId: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            >
              <option value="">
                {schoolsQuery.isLoading || collegesQuery.isLoading ? 'Loading institutions...' : 'Select institution'}
              </option>
              {institutionOptions.map((institution) => (
                <option key={institution._id} value={institution._id}>
                  {getInstitutionLabel(institution)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={formLabelClassName}>Programme Title</label>
            <input
              value={programForm.title}
              onChange={(event) => updateProgramForm({ title: event.target.value })}
              placeholder="Enter the programme title"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
          <div>
            <label className={formLabelClassName}>Assigned Mentor</label>
            <select
              value={programForm.mentorId}
              onChange={(event) => updateProgramForm({ mentorId: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            >
              <option value="">Select mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor._id} value={mentor._id}>
                  {mentor.displayName} • {mentor.assignedPrograms} programs • {mentor.assignedProjects} projects
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={formLabelClassName}>Objective</label>
          <textarea
            value={programForm.objective}
            onChange={(event) => updateProgramForm({ objective: event.target.value })}
            placeholder="Describe the objective and expected outcomes"
            className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={formLabelClassName}>Preferred Date & Time</label>
            <input
              type="datetime-local"
              value={programForm.preferredDate}
              onChange={(event) => updateProgramForm({ preferredDate: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
          <div>
            <label className={formLabelClassName}>Scheduled Date & Time</label>
            <input
              type="datetime-local"
              value={programForm.scheduledAt}
              onChange={(event) => updateProgramForm({ scheduledAt: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={formLabelClassName}>Duration (Minutes)</label>
            <input
              type="number"
              min={30}
              max={480}
              value={programForm.durationMinutes}
              onChange={(event) => updateProgramForm({ durationMinutes: event.target.value })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
        </div>

        {programForm.deliveryMode === 'Online' ? (
          <div>
            <label className={formLabelClassName}>Meeting Link</label>
            <input
              value={programForm.meetingLink}
              onChange={(event) => updateProgramForm({ meetingLink: event.target.value })}
              placeholder="Paste the Google Meet, Zoom, or Teams link"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
        ) : (
          <div>
            <label className={formLabelClassName}>Venue</label>
            <input
              value={programForm.venue}
              onChange={(event) => updateProgramForm({ venue: event.target.value })}
              placeholder="Enter the campus venue or room"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={formLabelClassName}>Preferred Expertise</label>
            <input
              value={programForm.preferredExpertise}
              onChange={(event) => updateProgramForm({ preferredExpertise: event.target.value })}
              placeholder="Example: Product strategy, investor readiness"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className={formLabelClassName}>Admin Notes</label>
            <textarea
              value={programForm.adminNotes}
              onChange={(event) => updateProgramForm({ adminNotes: event.target.value })}
              placeholder="Add internal notes or logistics context"
              className="min-h-24 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={
            createProgramMutation.isPending ||
            mentors.length === 0 ||
            institutionOptions.length === 0 ||
            !programForm.institutionId ||
            !programForm.mentorId
          }
        >
          {createProgramMutation.isPending ? 'Creating...' : 'Create Mentorship Programme'}
        </Button>
      </form>
    </Card>
  );
}
