import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { collegeApi } from '../../api/college.api';
import {
  getOptionTabClassName,
  getOptionTabsListClassName,
} from '../../components/ui/OptionTabs';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';
import HiringPartnersList from './HiringPartnersList';
import PlacementStatusTable from './PlacementStatusTable';

const PLACEMENT_VIEW_ITEMS: Array<{
  id: 'overview';
  label: string;
  path: string;
}> = [
  { id: 'overview', label: 'Overview', path: '/dashboard/college/placement' },
];

const VIEW_COPY = {
  overview: {
    title: 'Placement Overview',
    description: 'Review the full placement pipeline across discovered, active, and hired student outcomes.',
    recordsTitle: 'Placement Status Table',
    recordsPlaceholder: 'Search by student, recruiter, company, or status',
    partnersTitle: 'Recruiters currently scouting',
    partnersDescription: 'Active hiring partners connected to your institution placement pipeline.',
  },
};

export default function PlacementTracker() {
  const placementQuery = useQuery({
    queryKey: ['college-placement'],
    queryFn: collegeApi.getPlacementTracker,
  });

  const data = placementQuery.data;
  const copy = VIEW_COPY.overview;

  const inProgressCount = useMemo(
    () =>
      (data?.placementTable ?? []).filter((record) => record.status === 'In Progress').length,
    [data?.placementTable],
  );
  const visibleRecords = data?.placementTable ?? [];
  const visiblePartners = data?.hiringPartners ?? [];

  const exportCsv = () => {
    if (!data) {
      return;
    }

    const rows = [
      ['Student Name', 'Innovation Score', 'Status', 'Recruiter / Company', 'Last Updated'],
      ...data.placementTable.map((record) => [
        record.studentName,
        String(record.innovationScore),
        record.status,
        record.companyName ?? record.recruiterName ?? '',
        new Date(record.updatedAt).toLocaleDateString('en-IN'),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'placement-data.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="Student Workspace"
        title={copy.title}
        description={copy.description}
        showMenu={false}
        headerAction={
          <Button onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export Placement Data
          </Button>
        }
tabsAction={
          <NavLink
            to="/dashboard/college/placement"
            end
            className={getOptionTabClassName({ active: true })}
          >
            <span>Overview</span>
          </NavLink>
        }
      />

<div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-3xl font-bold text-white">{data?.totalInnovators ?? 0}</div>
          <div className="mt-2 text-sm text-slate-400">Total Innovators</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-bold text-white">{inProgressCount}</div>
          <div className="mt-2 text-sm text-slate-400">In Progress</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-bold text-white">{data?.studentsPlaced ?? 0}</div>
          <div className="mt-2 text-sm text-slate-400">Students Placed</div>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Hiring Partners</div>
          <h2 className="mt-2 text-xl font-semibold text-white">{copy.partnersTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{copy.partnersDescription}</p>
        </div>
        <HiringPartnersList partners={visiblePartners} />
      </div>

      <PlacementStatusTable
        records={visibleRecords}
        title={copy.recordsTitle}
        placeholder={copy.recordsPlaceholder}
      />
      <div className="text-sm text-slate-500" title="Status is updated by recruiters">
        Status is updated by recruiters.
      </div>
    </div>
  );
}
