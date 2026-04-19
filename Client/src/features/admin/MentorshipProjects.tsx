import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function MentorshipProjects() {
  const queryClient = useQueryClient();
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({});

  const projectMentorshipsQuery = useQuery({
    queryKey: ['admin-project-mentorships'],
    queryFn: adminApi.getProjectMentorships,
  });
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  const projectReviewMutation = useMutation({
    mutationFn: ({
      workspaceId,
      payload,
    }: {
      workspaceId: string;
      payload: Parameters<typeof adminApi.reviewProjectMentorship>[1];
    }) => adminApi.reviewProjectMentorship(workspaceId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-project-mentorships'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] }),
      ]);
    },
  });

  const projectAssignments = projectMentorshipsQuery.data?.items ?? [];
  const mentors = mentorsQuery.data ?? [];

  const getProjectDraft = (workspaceId: string) =>
    projectDrafts[workspaceId] ??
    projectAssignments.find((item) => item.workspaceId === workspaceId)?.mentor?._id ??
    '';

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Project Mentorship</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Admin-assigned mentor coverage for projects</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Research-backed matching works best when logistics, project goals, and mentor expertise are visible.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total', value: projectMentorshipsQuery.data?.stats.total ?? 0 },
            { label: 'Assigned', value: projectMentorshipsQuery.data?.stats.assigned ?? 0 },
            { label: 'Unassigned', value: projectMentorshipsQuery.data?.stats.unassigned ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
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
              <div key={assignment.workspaceId} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
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
  );
}
