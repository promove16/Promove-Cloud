import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collegeApi } from '../../api/college.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';

export default function RecruiterDirectory() {
  const [search, setSearch] = useState('');

  const recruitersQuery = useQuery({
    queryKey: ['college-recruiters'],
    queryFn: collegeApi.getRecruiters,
  });

  const recruiters = useMemo(
    () =>
      (recruitersQuery.data ?? []).filter((recruiter) =>
        `${recruiter.displayName} ${recruiter.company} ${recruiter.domains.join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [recruitersQuery.data, search],
  );

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="Student Workspace"
        title="Recruiter Directory"
        description="Companies actively scouting from your institution"
        tabsAction={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by recruiter or company"
              className="pl-11"
            />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {recruiters.length > 0 ? (
          recruiters.map((recruiter) => (
            <Card key={recruiter._id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl font-bold text-white">
                    {recruiter.avatar ? (
                      <img
                        src={recruiter.avatar}
                        alt={recruiter.displayName}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      recruiter.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-white">{recruiter.displayName}</div>
                    <div className="mt-1 text-sm text-amber-300">{recruiter.company}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recruiter.domains.map((domain) => (
                        <span key={domain} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 text-right">
                  <div>
                    <div className="text-2xl font-bold text-white">{recruiter.activePositions}</div>
                    <div className="text-xs text-slate-400">Active Positions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{recruiter.activeDrives}</div>
                    <div className="text-xs text-slate-400">Active Drives</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <Link to="/dashboard/college/placement" className="flex-1">
                  <Button className="w-full">Open Placement Tracker</Button>
                </Link>
                <Link
                  to="/dashboard/college/events?tab=hiring"
                  className="flex-1"
                >
                  <Button variant="secondary" className="w-full">
                    View Hiring Events
                  </Button>
                </Link>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-slate-400">
            No recruiters with active jobs or drives are linked to this institution yet.
          </Card>
        )}
      </div>
    </div>
  );
}
