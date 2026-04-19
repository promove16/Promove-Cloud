import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
import { ADMIN_MENTORSHIP_SECTION_LINKS } from './mentorshipNavigation';

export default function MentorshipPrograms() {
  const location = useLocation();
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_MENTORSHIP_SECTION_LINKS);

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

  const summary = useMemo(
    () => ({
      mentors: mentorsQuery.data?.length ?? 0,
      pendingPrograms: programsQuery.data?.stats.pending ?? 0,
      assignedPrograms: programsQuery.data?.stats.assigned ?? 0,
      unassignedProjects: projectMentorshipsQuery.data?.stats.unassigned ?? 0,
    }),
    [mentorsQuery.data, programsQuery.data?.stats, projectMentorshipsQuery.data?.stats],
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Mentorship</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[32rem]">
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Mentors</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.mentors}</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Pending requests</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.pendingPrograms}</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Assigned programs</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.assignedPrograms}</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Projects awaiting mentor</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.unassignedProjects}</div>
              </div>
            </div>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_MENTORSHIP_SECTION_LINKS} />
      </section>

      {programsQuery.isLoading && mentorsQuery.isLoading && projectMentorshipsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : programsQuery.isError || mentorsQuery.isError || projectMentorshipsQuery.isError ? (
        <Card className="border-dashed p-6 text-sm text-slate-400">
          Mentorship data is unavailable right now.
        </Card>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
