import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { emptyMentorForm, formLabelClassName, type MentorFormState } from './mentorshipAdminShared';

export default function MentorshipMentors() {
  const queryClient = useQueryClient();
  const [mentorForm, setMentorForm] = useState<MentorFormState>(emptyMentorForm());
  const [lastCreatedPassword, setLastCreatedPassword] = useState('');

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

  const mentors = mentorsQuery.data ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Profiles</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Create mentor access</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create mentor accounts directly so assignment workflows do not depend on a separate onboarding page.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <GraduationCap className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleCreateMentor}>
          <div>
            <label className={formLabelClassName}>Mentor Name</label>
            <input
              value={mentorForm.displayName}
              onChange={(event) => setMentorForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Enter the mentor's full name"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
          <div>
            <label className={formLabelClassName}>Mentor Email</label>
            <input
              type="email"
              value={mentorForm.email}
              onChange={(event) => setMentorForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Enter the mentor's email address"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
          </div>
          <div>
            <label className={formLabelClassName}>Domain / Expertise</label>
            <input
              value={mentorForm.domain}
              onChange={(event) => setMentorForm((current) => ({ ...current, domain: event.target.value }))}
              placeholder="Example: Product strategy, AI, finance"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className={formLabelClassName}>Headline</label>
            <input
              value={mentorForm.headline}
              onChange={(event) => setMentorForm((current) => ({ ...current, headline: event.target.value }))}
              placeholder="Add a short professional headline"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className={formLabelClassName}>Bio</label>
            <textarea
              value={mentorForm.bio}
              onChange={(event) => setMentorForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Add a short bio describing the mentor's background"
              className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
          <Button type="submit" disabled={createMentorMutation.isPending}>
            {createMentorMutation.isPending ? 'Creating...' : 'Create Mentor Profile'}
          </Button>
        </form>

        {lastCreatedPassword ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Temporary password: <span className="font-mono font-semibold">{lastCreatedPassword}</span>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Capacity</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Available mentor roster</h2>
        <p className="mt-2 text-sm text-slate-400">
          Use the full roster here before assigning programs or projects elsewhere in the mentorship workspace.
        </p>

        <div className="mt-6 space-y-3">
          {mentorsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : mentors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">
              No mentors have been created yet.
            </div>
          ) : (
            mentors.map((mentor) => (
              <div key={mentor._id} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
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
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
