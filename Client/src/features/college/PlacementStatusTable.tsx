import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PlacementRecordView } from '../../types/placement.types';

type Props = {
  records: PlacementRecordView[];
};

const statusTone: Record<string, string> = {
  Hired: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Shortlisted: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  'In Progress': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Rejected: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  Discovered: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
};

export default function PlacementStatusTable({ records }: Props) {
  const [search, setSearch] = useState('');

  const filteredRecords = useMemo(
    () =>
      records.filter((record) =>
        `${record.studentName} ${record.recruiterName ?? ''} ${record.companyName ?? ''} ${record.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [records, search],
  );

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Placement Status Table</div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by student, recruiter, company, or status"
        />
      </div>
      <div className="grid grid-cols-[1.3fr,180px,160px,1fr,160px] border-b border-slate-800 bg-slate-900 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
        <div>Student Name</div>
        <div>Innovation Score</div>
        <div>Status</div>
        <div>Recruiter / Company</div>
        <div>Last Updated</div>
      </div>
      <div className="divide-y divide-slate-800">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <div key={record._id} className="grid grid-cols-[1.3fr,180px,160px,1fr,160px] items-center gap-4 px-5 py-4">
              <div className="font-semibold text-white">{record.studentName}</div>
              <div className="text-slate-300">{record.innovationScore}</div>
              <div
                title="Status is updated by recruiters"
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[record.status]}`}
              >
                {record.status}
              </div>
              <div className="text-slate-400">
                {record.companyName ?? record.recruiterName ?? 'Awaiting recruiter action'}
              </div>
              <div className="text-sm text-slate-500">
                {new Date(record.updatedAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-8 text-sm text-slate-400">
            No placement records match the current search.
          </div>
        )}
      </div>
    </Card>
  );
}
