import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { collegeApi } from '../../api/college.api';
import HiringPartnersList from './HiringPartnersList';
import PlacementStatusTable from './PlacementStatusTable';

export default function PlacementTracker() {
  const placementQuery = useQuery({
    queryKey: ['college-placement'],
    queryFn: collegeApi.getPlacementTracker,
  });

  const data = placementQuery.data;

  const inProgressCount = useMemo(
    () =>
      (data?.placementTable ?? []).filter((record) =>
        ['Shortlisted', 'In Progress', 'Discovered'].includes(record.status),
      ).length,
    [data?.placementTable],
  );

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Placement Tracker</h1>
          <p className="mt-2 text-slate-400">Product-to-Employee Pipeline</p>
        </div>
        <Button onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export Placement Data
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          ['Placement Velocity', `${data?.placementVelocity ?? 0}%`],
          ['Total Innovators', String(data?.totalInnovators ?? 0)],
          ['Students Placed', String(data?.studentsPlaced ?? 0)],
          ['In Progress', String(inProgressCount)],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="mt-2 text-sm text-slate-400">{label}</div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Hiring Partners</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Recruiters currently scouting</h2>
        </div>
        <HiringPartnersList partners={data?.hiringPartners ?? []} />
      </div>

      <PlacementStatusTable records={data?.placementTable ?? []} />
      <div className="text-sm text-slate-500" title="Status is updated by recruiters">
        Status is updated by recruiters.
      </div>
    </div>
  );
}
