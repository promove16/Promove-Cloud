import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { AdminPageHeader, type AdminHeaderStat } from './AdminPageHeader';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
import { ADMIN_PATENTS_SECTION_LINKS } from './patentsNavigation';

export default function PatentsWorkspace() {
  const location = useLocation();
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_PATENTS_SECTION_LINKS);

  const directQuery = useQuery({
    queryKey: ['admin-patents', 'all'],
    queryFn: () => adminApi.getPatents(),
    refetchInterval: 60_000,
  });

  const assistedQuery = useQuery({
    queryKey: ['admin-patent-requests', 'all'],
    queryFn: () => adminApi.getPatentRequests(),
    refetchInterval: 60_000,
  });

  const directItems = directQuery.data ?? [];
  const directPending = directItems.filter((item) => item.status === 'submitted' || item.status === 'under_review').length;
  const directApproved = directItems.filter((item) => item.status === 'approved').length;

  const assistedItems = assistedQuery.data?.items ?? [];
  const assistedActive = assistedItems.filter((item) => item.status !== 'granted' && item.status !== 'rejected' && item.status !== 'abandoned').length;
  const assistedGranted = assistedItems.filter((item) => item.status === 'granted').length;

  const stats: AdminHeaderStat[] = [
    { label: 'Direct Submissions Pending', value: directPending, accent: 'emerald' },
    { label: 'Direct Approved', value: directApproved, accent: 'cyan' },
    { label: 'Active Assisted Cases', value: assistedActive, accent: 'amber' },
    { label: 'Granted / Completed Handovers', value: assistedGranted, accent: 'violet' },
  ];

  const isDirectTab = activeSection.path.endsWith('/review');

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Patent Management Workspace"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span>{activeSection.label}</span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                isDirectTab
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              }`}
            >
              {isDirectTab ? 'Direct Intake Workflow' : 'Assisted Lifecycle Workflow'}
            </span>
          </div>
        }
        description={activeSection.description}
        stats={stats}
      />

      <section className="border-b border-slate-800/80 pb-3">
        <AdminSectionTabs links={ADMIN_PATENTS_SECTION_LINKS} />
      </section>

      <Outlet />
    </div>
  );
}

