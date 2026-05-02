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
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  const summary = useMemo(
    () => ({
      mentors: mentorsQuery.data?.length ?? 0,
      pendingPrograms: programsQuery.data?.stats.pending ?? 0,
      assignedPrograms: programsQuery.data?.stats.assigned ?? 0,
    }),
    [mentorsQuery.data, programsQuery.data?.stats],
  );

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="px-1 pb-6">
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr),auto] 2xl:items-end">
            <div className="min-w-0 max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Mentorship</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="text-sm text-slate-400">
              <span className="font-medium text-slate-100">{summary.mentors}</span> mentors
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{summary.pendingPrograms}</span> pending requests
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{summary.assignedPrograms}</span> assigned
            </div>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_MENTORSHIP_SECTION_LINKS} />
      </section>

      {programsQuery.isLoading && mentorsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : programsQuery.isError || mentorsQuery.isError ? (
        <Card className="border-dashed p-6 text-sm text-slate-400">
          Mentorship data is unavailable right now.
        </Card>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
