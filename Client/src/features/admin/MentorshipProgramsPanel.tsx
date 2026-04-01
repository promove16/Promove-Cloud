import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarDays, GraduationCap, Users } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  AdminMentorListItem,
  ReviewMentorshipProgramInput,
  ReviewProjectMentorAssignmentInput,
} from '../../types/mentorship.types';

type MentorFormState = {
  displayName: string;
  email: string;
  domain: string;
  bio: string;
  headline: string;
};

type AssignmentDraft = {
  mentorId: string;
  scheduledAt: string;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink: string;
  venue: string;
  adminNotes: string;
};

const emptyMentorForm = (): MentorFormState => ({
  displayName: '',
  email: '',
  domain: '',
  bio: '',
  headline: '',
});

const emptyAssignmentDraft = (): AssignmentDraft => ({
  mentorId: '',
  scheduledAt: '',
  deliveryMode: 'Online',
  platform: 'Google Meet',
  meetingLink: '',
  venue: '',
  adminNotes: '',
});

export default function MentorshipProgramsPanel() {
  const queryClient = useQueryClient();
  const [mentorForm, setMentorForm] = useState<MentorFormState>(emptyMentorForm());
  const [lastCreatedPassword, setLastCreatedPassword] = useState<string>('');
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({});

  const programsQuery = useQuery({
    queryKey: ['admin-mentorship-programs'],
    queryFn: () => adminApi.getMentorshipPrograms(),
  });
  const projectMentorshipsQuery = useQuery({
    queryKey: ['admin-project-mentorships'],
    queryFn: adminApi.getProjectMentorships,
  });
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  const createMentorMutation = useMutation({
    mutationFn: adminApi.createMentorProfile,
    onSuccess: async (result) => {
      setLastCreatedPassword(result.temporaryPassword);
      setMentorForm(emptyMentorForm());
      await queryClient.invalidateQueries({ queryKey: ['admin-mentors'] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewMentorshipProgramInput }) =>
      adminApi.reviewMentorshipProgram(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-mentorship-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
  });
  const projectReviewMutation = useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: ReviewProjectMentorAssignmentInput }) =>
      adminApi.reviewProjectMentorship(workspaceId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-project-mentorships'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
  });

  const pendingPrograms = useMemo(
    () => (programsQuery.data?.items ?? []).filter((item) => item.status === 'Pending'),
    [programsQuery.data?.items],
  );
  const projectAssignments = projectMentorshipsQuery.data?.items ?? [];
  const mentors = mentorsQuery.data ?? [];

  const handleCreateMentor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMentorMutation.mutate({
      displayName: mentorForm.displayName,
      email: mentorForm.email,
      ...(mentorForm.domain.trim() ? { domain: mentorForm.domain.trim() } : {}),
      ...(mentorForm.bio.trim() ? { bio: mentorForm.bio.trim() } : {}),
      ...(mentorForm.headline.trim() ? { headline: mentorForm.headline.trim() } : {}),
    });
  };

  const getDraft = (id: string) => assignmentDrafts[id] ?? emptyAssignmentDraft();

  const updateDraft = (id: string, patch: Partial<AssignmentDraft>) =>
    setAssignmentDrafts((current) => ({
      ...current,
      [id]: { ...getDraft(id), ...patch },
    }));

  const getProjectDraft = (workspaceId: string) =>
    projectDrafts[workspaceId] ?? projectAssignments.find((item) => item.workspaceId === workspaceId)?.mentor?._id ?? '';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Profiles</div>
              <h2 className="mt-2 text-2xl font-bold text-white">Create mentor access</h2>
              <p className="mt-2 text-sm text-slate-400">
                Admin can create mentor accounts directly and assign them to school or college programs.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
              <GraduationCap className="h-6 w-6 text-cyan-300" />
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCreateMentor}>
            <input
              value={mentorForm.displayName}
              onChange={(event) => setMentorForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Mentor name"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <input
              type="email"
              value={mentorForm.email}
              onChange={(event) => setMentorForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Mentor email"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <input
              value={mentorForm.domain}
              onChange={(event) => setMentorForm((current) => ({ ...current, domain: event.target.value }))}
              placeholder="Domain / expertise"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <input
              value={mentorForm.headline}
              onChange={(event) => setMentorForm((current) => ({ ...current, headline: event.target.value }))}
              placeholder="Headline"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <textarea
              value={mentorForm.bio}
              onChange={(event) => setMentorForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Short mentor bio"
              className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <Button type="submit" disabled={createMentorMutation.isPending}>
              {createMentorMutation.isPending ? 'Creating...' : 'Create Mentor Profile'}
            </Button>
          </form>

          {lastCreatedPassword ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Temporary password: <span className="font-mono font-semibold">{lastCreatedPassword}</span>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {(mentors.slice(0, 4) as AdminMentorListItem[]).map((mentor) => (
              <div key={mentor._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{mentor.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{mentor.email}</div>
                    {mentor.domain ? <div className="mt-1 text-sm text-cyan-200">{mentor.domain}</div> : null}
                    {mentor.headline ? <div className="mt-1 text-sm text-slate-500">{mentor.headline}</div> : null}
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <div>{mentor.assignedProjects} projects</div>
                    <div>{mentor.assignedPrograms} programs</div>
                    <div>{new Date(mentor.createdAt).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentorship Requests</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Pending institution requests</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Total', value: programsQuery.data?.stats.total ?? 0, icon: CalendarDays },
              { label: 'Pending', value: programsQuery.data?.stats.pending ?? 0, icon: GraduationCap },
              { label: 'Assigned', value: programsQuery.data?.stats.assigned ?? 0, icon: Users },
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
                  <div key={program._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
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
                      <select
                        value={draft.mentorId}
                        onChange={(event) => updateDraft(program._id, { mentorId: event.target.value })}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      >
                        <option value="">Select mentor</option>
                        {mentors.map((mentor) => (
                          <option key={mentor._id} value={mentor._id}>
                            {mentor.displayName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={draft.scheduledAt}
                        onChange={(event) => updateDraft(program._id, { scheduledAt: event.target.value })}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      />
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
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      >
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                      </select>
                      <select
                        value={draft.platform}
                        onChange={(event) => updateDraft(program._id, { platform: event.target.value as AssignmentDraft['platform'] })}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
                      {draft.deliveryMode === 'Online' ? (
                        <input
                          value={draft.meetingLink}
                          onChange={(event) => updateDraft(program._id, { meetingLink: event.target.value })}
                          placeholder="Meeting link"
                          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
                        />
                      ) : (
                        <input
                          value={draft.venue}
                          onChange={(event) => updateDraft(program._id, { venue: event.target.value })}
                          placeholder="Venue"
                          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
                        />
                      )}
                      <textarea
                        value={draft.adminNotes}
                        onChange={(event) => updateDraft(program._id, { adminNotes: event.target.value })}
                        placeholder="Admin notes"
                        className="min-h-24 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
                      />
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
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Project Mentorship</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Admin-assigned mentor coverage for projects</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Research-backed matching works best when logistics, project goals, and mentor expertise are visible. These are the active workspaces currently launched for mentorship or already assigned.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Total', value: projectMentorshipsQuery.data?.stats.total ?? 0 },
              { label: 'Assigned', value: projectMentorshipsQuery.data?.stats.assigned ?? 0 },
              { label: 'Unassigned', value: projectMentorshipsQuery.data?.stats.unassigned ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950">
                  <BriefcaseBusiness className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {projectMentorshipsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              Loading project mentorship queue...
            </div>
          ) : projectAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No project mentorship candidates are live yet.
            </div>
          ) : (
            projectAssignments.map((assignment) => {
              const selectedMentorId = getProjectDraft(assignment.workspaceId);

              return (
                <div key={assignment.workspaceId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="font-semibold text-white">{assignment.title}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {assignment.startupName ?? 'Workspace'} • {assignment.category} • {assignment.stage}
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        Students: {assignment.students.map((student) => student.displayName).join(', ')}
                      </div>
                      {assignment.preferredExpertise ? (
                        <div className="mt-2 text-sm text-cyan-200">Preferred expertise: {assignment.preferredExpertise}</div>
                      ) : null}
                      <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Progress {assignment.progressPercent}% • Updated {new Date(assignment.updatedAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                      {assignment.mentor ? `Assigned to ${assignment.mentor.displayName}` : 'Awaiting mentor'}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                    <select
                      value={selectedMentorId}
                      onChange={(event) =>
                        setProjectDrafts((current) => ({
                          ...current,
                          [assignment.workspaceId]: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white lg:min-w-[260px]"
                    >
                      <option value="">Select mentor</option>
                      {mentors.map((mentor) => (
                        <option key={mentor._id} value={mentor._id}>
                          {mentor.displayName} • {mentor.assignedProjects} projects • {mentor.assignedPrograms} programs
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() =>
                          projectReviewMutation.mutate({
                            workspaceId: assignment.workspaceId,
                            payload: {
                              decision: 'assigned',
                              mentorId: selectedMentorId,
                            },
                          })
                        }
                        disabled={projectReviewMutation.isPending || !selectedMentorId}
                      >
                        {assignment.mentor ? 'Reassign Mentor' : 'Assign Mentor'}
                      </Button>
                      {assignment.mentor ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            projectReviewMutation.mutate({
                              workspaceId: assignment.workspaceId,
                              payload: { decision: 'unassigned' },
                            })
                          }
                          disabled={projectReviewMutation.isPending}
                        >
                          Remove Mentor
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
