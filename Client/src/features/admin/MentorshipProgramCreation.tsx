import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { UserRole } from '../../types/roles.types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  createPickerOnlyDateTimeInputHandlers,
  emptyProgramForm,
  type ProgramFormState,
} from './mentorshipAdminShared';
import { InstitutionSearchField } from './InstitutionSearchField';
import { MentorSearchField } from './MentorSearchField';
import { toast } from 'sonner';
import { Check, CalendarClock, History, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import type { InstitutionMentorshipProgram } from '../../types/mentorship.types';

const field =
  'w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500/60 focus:bg-slate-950';

const selectField = `${field} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-8`;

const label = 'mb-1.5 block text-xs font-medium text-slate-400';

type DeliveryMode = 'Online' | 'Offline';
type Platform = 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';

type EditFormState = {
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt: string;
  durationMinutes: string;
  expectedParticipants: string;
  deliveryMode: DeliveryMode;
  platform: Platform;
  meetingLink: string;
  venue: string;
  preferredExpertise: string;
  adminNotes: string;
  mentorId: string;
};

const toLocalDatetime = (iso?: string) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : '';

const programToEditForm = (p: InstitutionMentorshipProgram): EditFormState => ({
  title: p.title,
  objective: p.objective,
  preferredDate: toLocalDatetime(p.preferredDate),
  scheduledAt: toLocalDatetime(p.scheduledAt),
  durationMinutes: String(p.durationMinutes),
  expectedParticipants: String(p.expectedParticipants),
  deliveryMode: p.deliveryMode,
  platform: p.platform,
  meetingLink: p.meetingLink ?? '',
  venue: p.venue ?? '',
  preferredExpertise: p.preferredExpertise ?? '',
  adminNotes: p.adminNotes ?? '',
  mentorId: p.mentor?._id ?? '',
});

export default function MentorshipProgramCreation() {
  const queryClient = useQueryClient();
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm());
  const [editingProgram, setEditingProgram] = useState<InstitutionMentorshipProgram | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [deletingProgramTitle, setDeletingProgramTitle] = useState('');

  const programsQuery = useQuery({
    queryKey: ['admin-mentorship-programs', 'Assigned'],
    queryFn: () => adminApi.getMentorshipPrograms({ status: 'Assigned' }),
  });

  const mentorsQuery = useQuery({ queryKey: ['admin-mentors'], queryFn: adminApi.getMentors });
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
    onSuccess: () => {
      setProgramForm(emptyProgramForm());
      toast.success('Program created successfully.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to create program.'));
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof adminApi.updateMentorshipProgram>[1] }) =>
      adminApi.updateMentorshipProgram(id, payload),
    onSuccess: () => {
      setEditingProgram(null);
      setEditForm(null);
      toast.success('Program updated.');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to update program.'));
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: adminApi.deleteMentorshipProgram,
    onSuccess: () => {
      setDeletingProgramId(null);
      toast.success('Program deleted.');
      void queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to delete program.'));
    },
  });

  const mentors = mentorsQuery.data ?? [];
  const schools = schoolsQuery.data?.items ?? [];
  const colleges = collegesQuery.data?.items ?? [];
  const institutionOptions = useMemo(
    () =>
      (programForm.institutionType === 'school' ? schools : colleges).filter(
        (institution) => institution.isActive,
      ),
    [colleges, programForm.institutionType, schools],
  );

  const now = new Date();
  const assignedPrograms: InstitutionMentorshipProgram[] = programsQuery.data?.items ?? [];
  const upcoming = useMemo(
    () =>
      assignedPrograms
        .filter((p) => p.scheduledAt && new Date(p.scheduledAt) > now)
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignedPrograms],
  );
  const previous = useMemo(
    () =>
      assignedPrograms
        .filter((p) => !p.scheduledAt || new Date(p.scheduledAt) <= now)
        .sort((a, b) => new Date(b.scheduledAt ?? b.createdAt).getTime() - new Date(a.scheduledAt ?? a.createdAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignedPrograms],
  );

  const canCreate =
    !createProgramMutation.isPending &&
    mentors.length > 0 &&
    institutionOptions.length > 0 &&
    Boolean(programForm.institutionId) &&
    Boolean(programForm.mentorId);

  const set = (patch: Partial<ProgramFormState>) =>
    setProgramForm((prev) => ({ ...prev, ...patch }));

  const setEdit = (patch: Partial<EditFormState>) =>
    setEditForm((prev) => prev ? { ...prev, ...patch } : prev);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProgram || !editForm) return;
    updateProgramMutation.mutate({
      id: editingProgram._id,
      payload: {
        title: editForm.title.trim(),
        objective: editForm.objective.trim(),
        preferredDate: editForm.preferredDate ? new Date(editForm.preferredDate).toISOString() : undefined,
        scheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : undefined,
        durationMinutes: Number(editForm.durationMinutes),
        expectedParticipants: Number(editForm.expectedParticipants),
        deliveryMode: editForm.deliveryMode,
        platform: editForm.platform,
        meetingLink: editForm.deliveryMode === 'Online' ? editForm.meetingLink.trim() : '',
        venue: editForm.deliveryMode === 'Offline' ? editForm.venue.trim() : '',
        preferredExpertise: editForm.preferredExpertise.trim(),
        adminNotes: editForm.adminNotes.trim(),
        ...(editForm.mentorId ? { mentorId: editForm.mentorId } : {}),
      },
    });
  };

  const handleEditOpen = (p: InstitutionMentorshipProgram) => {
    setEditingProgram(p);
    setEditForm(programToEditForm(p));
  };

  const handleEditClose = () => {
    setEditingProgram(null);
    setEditForm(null);
  };

  const handleDeleteOpen = (p: InstitutionMentorshipProgram) => {
    setDeletingProgramId(p._id);
    setDeletingProgramTitle(p.title);
  };

  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-950 shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <h2 className="text-base font-semibold text-white">Create Program</h2>
            <Button
              type="submit"
              disabled={!canCreate}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
            >
              <Check className="h-3.5 w-3.5" />
              {createProgramMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>

          {/* Form body — two-column layout */}
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:divide-x lg:divide-slate-800">

            {/* Left column — Who & What */}
            <div className="space-y-4 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Program Setup</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Type</label>
                  <select
                    value={programForm.institutionType}
                    onChange={(e) =>
                      setProgramForm((prev) => ({
                        ...prev,
                        institutionType: e.target.value as ProgramFormState['institutionType'],
                        institutionId: '',
                      }))
                    }
                    className={selectField}
                  >
                    <option value="school">School</option>
                    <option value="college">College</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Title</label>
                  <input
                    value={programForm.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Programme title"
                    className={field}
                    required
                  />
                </div>
              </div>

              <InstitutionSearchField
                institutions={institutionOptions}
                value={programForm.institutionId}
                onChange={(institutionId) => set({ institutionId })}
              />

              <MentorSearchField
                mentors={mentors}
                value={programForm.mentorId}
                onChange={(mentorId) => set({ mentorId })}
                preferredExpertise={programForm.preferredExpertise}
              />

              <div>
                <label className={label}>Expertise Required</label>
                <input
                  value={programForm.preferredExpertise}
                  onChange={(e) => set({ preferredExpertise: e.target.value })}
                  placeholder="e.g. AI/ML, Cloud Computing"
                  className={field}
                />
              </div>
            </div>

            {/* Right column — When & How */}
            <div className="space-y-4 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Schedule & Delivery</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Preferred Date</label>
                  <input
                    type="datetime-local"
                    value={programForm.preferredDate}
                    onChange={(e) => set({ preferredDate: e.target.value })}
                    {...createPickerOnlyDateTimeInputHandlers(() => set({ preferredDate: '' }))}
                    className={field}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={programForm.scheduledAt}
                    onChange={(e) => set({ scheduledAt: e.target.value })}
                    {...createPickerOnlyDateTimeInputHandlers(() => set({ scheduledAt: '' }))}
                    className={field}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Duration (min)</label>
                  <input
                    type="number"
                    min={30}
                    max={480}
                    value={programForm.durationMinutes}
                    onChange={(e) => set({ durationMinutes: e.target.value })}
                    className={field}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Participants</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={programForm.expectedParticipants}
                    onChange={(e) => set({ expectedParticipants: e.target.value })}
                    className={field}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Mode</label>
                  <select
                    value={programForm.deliveryMode}
                    onChange={(e) => {
                      const deliveryMode = e.target.value as ProgramFormState['deliveryMode'];
                      set({
                        deliveryMode,
                        platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                        meetingLink: deliveryMode === 'Online' ? programForm.meetingLink : '',
                        venue: deliveryMode === 'Offline' ? programForm.venue : '',
                      });
                    }}
                    className={selectField}
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Platform</label>
                  <select
                    value={programForm.platform}
                    onChange={(e) =>
                      set({ platform: e.target.value as ProgramFormState['platform'] })
                    }
                    className={selectField}
                  >
                    {programForm.deliveryMode === 'Online' ? (
                      <>
                        <option value="Google Meet">Google Meet</option>
                        <option value="Microsoft Teams">MS Teams</option>
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
                  <label className={label}>Meeting Link</label>
                  <input
                    value={programForm.meetingLink}
                    onChange={(e) => set({ meetingLink: e.target.value })}
                    placeholder="Paste meeting URL"
                    className={field}
                  />
                </div>
              ) : (
                <div>
                  <label className={label}>Venue</label>
                  <input
                    value={programForm.venue}
                    onChange={(e) => set({ venue: e.target.value })}
                    placeholder="Seminar hall or room number"
                    className={field}
                  />
                </div>
              )}

              <div className="border-t border-slate-800 pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Notes</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Objective</label>
                    <textarea
                      value={programForm.objective}
                      onChange={(e) => set({ objective: e.target.value })}
                      placeholder="Goals and expected outcomes"
                      className={`${field} h-20 resize-none`}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Admin Notes</label>
                    <textarea
                      value={programForm.adminNotes}
                      onChange={(e) => set({ adminNotes: e.target.value })}
                      placeholder="Internal notes"
                      className={`${field} h-20 resize-none`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Card>

      {/* ── Programs List ─────────────────────────────────────────── */}
      <ProgramsList
        upcoming={upcoming}
        previous={previous}
        isLoading={programsQuery.isLoading}
        fmt={fmt}
        onEdit={handleEditOpen}
        onDelete={handleDeleteOpen}
      />

      {/* ── Edit Modal ────────────────────────────────────────────── */}
      {editingProgram && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Editing</p>
                <h3 className="text-base font-semibold text-white">{editingProgram.title}</h3>
              </div>
              <button
                type="button"
                onClick={handleEditClose}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 gap-0 p-6 lg:grid-cols-2 lg:gap-6">
                {/* Left */}
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Program Setup</p>
                  <div>
                    <label className={label}>Title</label>
                    <input
                      value={editForm.title}
                      onChange={(e) => setEdit({ title: e.target.value })}
                      className={field}
                      required
                    />
                  </div>
                  <MentorSearchField
                    mentors={mentors}
                    value={editForm.mentorId}
                    onChange={(mentorId) => setEdit({ mentorId })}
                    label="Assigned Mentor"
                    preferredExpertise={editForm.preferredExpertise}
                  />
                  <div>
                    <label className={label}>Expertise Required</label>
                    <input
                      value={editForm.preferredExpertise}
                      onChange={(e) => setEdit({ preferredExpertise: e.target.value })}
                      placeholder="e.g. AI/ML, Cloud Computing"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label}>Objective</label>
                    <textarea
                      value={editForm.objective}
                      onChange={(e) => setEdit({ objective: e.target.value })}
                      className={`${field} h-24 resize-none`}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Admin Notes</label>
                    <textarea
                      value={editForm.adminNotes}
                      onChange={(e) => setEdit({ adminNotes: e.target.value })}
                      placeholder="Internal notes"
                      className={`${field} h-20 resize-none`}
                    />
                  </div>
                </div>

                {/* Right */}
                <div className="mt-6 space-y-4 lg:mt-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Schedule & Delivery</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Preferred Date</label>
                      <input
                        type="datetime-local"
                        value={editForm.preferredDate}
                        onChange={(e) => setEdit({ preferredDate: e.target.value })}
                        {...createPickerOnlyDateTimeInputHandlers(() => setEdit({ preferredDate: '' }))}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label}>Scheduled Date</label>
                      <input
                        type="datetime-local"
                        value={editForm.scheduledAt}
                        onChange={(e) => setEdit({ scheduledAt: e.target.value })}
                        {...createPickerOnlyDateTimeInputHandlers(() => setEdit({ scheduledAt: '' }))}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label}>Duration (min)</label>
                      <input
                        type="number"
                        min={30}
                        max={480}
                        value={editForm.durationMinutes}
                        onChange={(e) => setEdit({ durationMinutes: e.target.value })}
                        className={field}
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>Participants</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={editForm.expectedParticipants}
                        onChange={(e) => setEdit({ expectedParticipants: e.target.value })}
                        className={field}
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>Mode</label>
                      <select
                        value={editForm.deliveryMode}
                        onChange={(e) => {
                          const mode = e.target.value as DeliveryMode;
                          setEdit({
                            deliveryMode: mode,
                            platform: mode === 'Online' ? 'Google Meet' : 'Offline',
                            meetingLink: mode === 'Online' ? editForm.meetingLink : '',
                            venue: mode === 'Offline' ? editForm.venue : '',
                          });
                        }}
                        className={selectField}
                      >
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </div>
                    <div>
                      <label className={label}>Platform</label>
                      <select
                        value={editForm.platform}
                        onChange={(e) => setEdit({ platform: e.target.value as Platform })}
                        className={selectField}
                      >
                        {editForm.deliveryMode === 'Online' ? (
                          <>
                            <option value="Google Meet">Google Meet</option>
                            <option value="Microsoft Teams">MS Teams</option>
                            <option value="Zoom">Zoom</option>
                          </>
                        ) : (
                          <option value="Offline">Offline</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {editForm.deliveryMode === 'Online' ? (
                    <div>
                      <label className={label}>Meeting Link</label>
                      <input
                        value={editForm.meetingLink}
                        onChange={(e) => setEdit({ meetingLink: e.target.value })}
                        placeholder="Paste meeting URL"
                        className={field}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={label}>Venue</label>
                      <input
                        value={editForm.venue}
                        onChange={(e) => setEdit({ venue: e.target.value })}
                        placeholder="Seminar hall or room number"
                        className={field}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
                <button
                  type="button"
                  onClick={handleEditClose}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={updateProgramMutation.isPending}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                >
                  <Check className="h-3.5 w-3.5" />
                  {updateProgramMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Delete Confirmation ───────────────────────────────────── */}
      {deletingProgramId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete program?</h3>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-300">{deletingProgramTitle}</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingProgramId(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteProgramMutation.isPending}
                onClick={() => deleteProgramMutation.mutate(deletingProgramId)}
                className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteProgramMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgramsList({
  upcoming,
  previous,
  isLoading,
  fmt,
  onEdit,
  onDelete,
}: {
  upcoming: InstitutionMentorshipProgram[];
  previous: InstitutionMentorshipProgram[];
  isLoading: boolean;
  fmt: (iso?: string) => string;
  onEdit: (p: InstitutionMentorshipProgram) => void;
  onDelete: (p: InstitutionMentorshipProgram) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (upcoming.length === 0 && previous.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-950">
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <CalendarClock className="h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">No programs created yet</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <ProgramSection
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Upcoming"
          accent="text-cyan-400"
          programs={upcoming}
          fmt={fmt}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      {previous.length > 0 && (
        <ProgramSection
          icon={<History className="h-3.5 w-3.5" />}
          label="Previous"
          accent="text-slate-500"
          programs={previous}
          fmt={fmt}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function ProgramSection({
  icon,
  label,
  accent,
  programs,
  fmt,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  programs: InstitutionMentorshipProgram[];
  fmt: (iso?: string) => string;
  onEdit: (p: InstitutionMentorshipProgram) => void;
  onDelete: (p: InstitutionMentorshipProgram) => void;
}) {
  return (
    <Card className="border-slate-800 bg-slate-950 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
        <span className={accent}>{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{label}</span>
        <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          {programs.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/60">
              {['Program', 'Institution', 'Mentor', 'Scheduled', 'Mode', 'Duration', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map((p, i) => (
              <tr
                key={p._id}
                className={`border-b border-slate-800/40 last:border-0 transition hover:bg-slate-900/40 ${
                  i % 2 === 0 ? '' : 'bg-slate-900/20'
                }`}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-white">{p.title}</div>
                  {p.preferredExpertise ? (
                    <div className="mt-0.5 text-xs text-cyan-500">{p.preferredExpertise}</div>
                  ) : null}
                </td>
                <td className="px-5 py-3">
                  <div className="text-slate-300">{p.institution.displayName}</div>
                  <div className="mt-0.5 text-xs capitalize text-slate-600">{p.institution.type}</div>
                </td>
                <td className="px-5 py-3">
                  {p.mentor ? (
                    <>
                      <div className="text-slate-300">{p.mentor.displayName}</div>
                      {p.mentor.domain ? (
                        <div className="mt-0.5 text-xs text-slate-600">{p.mentor.domain}</div>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-400">{fmt(p.scheduledAt)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                      p.deliveryMode === 'Online'
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.deliveryMode === 'Online' ? p.platform : 'Offline'}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-400">{p.durationMinutes} min</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="rounded p-1.5 text-slate-600 transition hover:bg-slate-800 hover:text-slate-300"
                      aria-label="Edit program"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="rounded p-1.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete program"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
