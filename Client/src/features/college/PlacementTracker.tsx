import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'drives'>('overview');
  const [expandedDriveId, setExpandedDriveId] = useState<string | null>(null);

  const placementQuery = useQuery({
    queryKey: ['college-placement'],
    queryFn: collegeApi.getPlacementTracker,
  });

  const drivesQuery = useQuery({
    queryKey: ['college-drives'],
    queryFn: collegeApi.getCollegeDrives,
    enabled: activeTab === 'drives',
  });

  const data = placementQuery.data;
  const drives = drivesQuery.data ?? [];
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

  const getDriveTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Placement Drive':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'Internship Drive':
        return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
      default:
        return 'border-amber-500/30 bg-amber-500/10 text-amber-300'; // Hackathon
    }
  };

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="Student Workspace"
        title={activeTab === 'overview' ? copy.title : 'Campus Opportunities'}
        description={activeTab === 'overview' ? copy.description : 'Track recruiter drives, internships, and hackathons scheduled for your campus.'}
        showMenu={false}
        headerAction={
          activeTab === 'overview' ? (
            <Button onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export Placement Data
            </Button>
          ) : undefined
        }
        tabsAction={
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-slate-100 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drives')}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === 'drives'
                  ? 'bg-slate-100 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Campus Opportunities
            </button>
          </div>
        }
      />

      {activeTab === 'overview' ? (
        <>
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
        </>
      ) : (
        <div className="space-y-6">
          {drivesQuery.isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner />
            </div>
          ) : drives.length === 0 ? (
            <Card className="p-8 text-center bg-slate-950 border-slate-800">
              <BriefcaseBusiness className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No campus opportunities yet</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                Partner recruiters can schedule Placement Drives, Internship Drives, and Hackathons for your college. They will appear here once published.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {drives.map((drive) => {
                const isExpanded = expandedDriveId === drive._id;
                return (
                  <Card key={drive._id} className="p-6 border-slate-800 bg-[#0b1329] transition hover:border-slate-700">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDriveTypeBadgeClass(drive.type)}`}>
                            {drive.type}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${drive.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
                            {drive.isActive ? 'Active' : 'Closed'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{drive.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-4xl">{drive.description}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-slate-500 font-medium">
                          <span>
                            Hosted by: <strong className="text-slate-300">{drive.recruiterName}</strong> ({drive.recruiterCompany})
                          </span>
                          <span>|</span>
                          <span>
                            Scheduled: <strong className="text-slate-300">{new Date(drive.scheduledAt).toLocaleString('en-IN')}</strong>
                          </span>
                          <span>|</span>
                          <span>
                            Min. Score: <strong className="text-slate-300">{drive.minimumInnovationScore}</strong>
                          </span>
                          <span>|</span>
                          <span>
                            Registered Students: <strong className="text-slate-300">{drive.registeredStudents.length}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end lg:self-start">
                        <Button
                          variant="secondary"
                          onClick={() => setExpandedDriveId(isExpanded ? null : drive._id)}
                          className="flex items-center gap-2"
                        >
                          {isExpanded ? (
                            <>
                              Hide Roster
                              <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              View Roster
                              <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-6 border-t border-slate-800/80 pt-6 space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300">Registered Students Roster</h4>
                        {drive.registeredStudents.length === 0 ? (
                          <div className="text-sm text-slate-500 italic">No students registered for this drive yet.</div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-950/40">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                  <th className="px-5 py-4">Student</th>
                                  <th className="px-5 py-4">Innovation Score</th>
                                  <th className="px-5 py-4">Registered At</th>
                                  <th className="px-5 py-4 text-right">Assessment Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850">
                                {drive.registeredStudents.map((registration) => (
                                  <tr key={registration.studentId} className="hover:bg-slate-900/10 text-slate-300">
                                    <td className="px-5 py-4 font-semibold text-white">
                                      {registration.studentName}
                                    </td>
                                    <td className="px-5 py-4 font-mono font-bold text-cyan-400">
                                      {registration.innovationScore}
                                    </td>
                                    <td className="px-5 py-4 text-slate-400 text-xs">
                                      {new Date(registration.registeredAt).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-5 py-4 text-right font-mono font-semibold text-amber-300">
                                      {typeof registration.submissionScore === 'number'
                                        ? registration.submissionScore
                                        : 'Pending'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
