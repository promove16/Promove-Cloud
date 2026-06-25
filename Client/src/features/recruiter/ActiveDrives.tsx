import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Plus,
  Search,
  Send,
  Star,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
  Briefcase,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterCampusSectionItems,
} from './RecruiterSectionNav';

type ActiveDrivesProps = {
  embedded?: boolean;
};

type DriveType = 'Placement Drive' | 'Internship Drive' | 'Hackathon';
type ActiveTab = 'overview' | 'candidates' | 'scores';
type TypeFilter = 'all' | DriveType;
type StatusFilter = 'all' | 'active' | 'closed';
type CandidateSort = 'score' | 'name' | 'date';

const formatDriveDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getDaysUntil = (value: string) =>
  Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const DRIVE_TYPE_CONFIG: Record<
  DriveType,
  { label: string; color: string; bg: string; border: string; badgeClass: string; Icon: typeof BriefcaseBusiness }
> = {
  'Placement Drive': {
    label: 'Placement',
    color: 'text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    badgeClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    Icon: BriefcaseBusiness,
  },
  'Internship Drive': {
    label: 'Internship',
    color: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    badgeClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    Icon: GraduationCap,
  },
  Hackathon: {
    label: 'Hackathon',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    Icon: Trophy,
  },
};

export default function ActiveDrives({ embedded = false }: ActiveDrivesProps) {
  const queryClient = useQueryClient();

  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [candidateSort, setCandidateSort] = useState<CandidateSort>('score');

  const [form, setForm] = useState({
    title: '',
    collegeId: '',
    type: 'Placement Drive' as DriveType,
    scheduledAt: '',
    description: '',
    minimumInnovationScore: 0,
  });
  const [submission, setSubmission] = useState({ studentId: '', submissionScore: 0 });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<{
    studentId: string;
    studentName: string;
    jobId: string;
    note: string;
  } | null>(null);

  const drivesQuery = useQuery({ queryKey: ['recruiter', 'drives'], queryFn: recruiterApi.getDrives });
  const collegesQuery = useQuery({ queryKey: ['recruiter', 'colleges'], queryFn: recruiterApi.getColleges });
  const jobsQuery = useQuery({ queryKey: ['recruiter', 'jobs'], queryFn: recruiterApi.getJobs });

  const drives = drivesQuery.data ?? [];
  const activeJobs = useMemo(() => (jobsQuery.data ?? []).filter((j) => j.isActive), [jobsQuery.data]);

  useEffect(() => {
    if (drives.length === 0) { setSelectedDriveId(null); return; }
    if (!selectedDriveId || !drives.some((d) => d._id === selectedDriveId)) {
      setSelectedDriveId(drives[0]._id);
    }
  }, [drives, selectedDriveId]);

  const selectedDrive = useMemo(() => drives.find((d) => d._id === selectedDriveId) ?? null, [drives, selectedDriveId]);
  const selectedConfig = useMemo(() => selectedDrive ? DRIVE_TYPE_CONFIG[selectedDrive.type] : null, [selectedDrive]);
  const daysUntilDrive = useMemo(() => selectedDrive ? getDaysUntil(selectedDrive.scheduledAt) : null, [selectedDrive]);

  const metrics = useMemo(() => {
    const totalRegs = drives.reduce((sum, d) => sum + d.registeredStudents.length, 0);
    const allScores = drives.flatMap((d) => d.registeredStudents.map((s) => s.innovationScore));
    return {
      total: drives.length,
      active: drives.filter((d) => d.isActive).length,
      registrations: totalRegs,
      avgScore: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
    };
  }, [drives]);

  const filteredDrives = useMemo(() =>
    drives.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !d.collegeName.toLowerCase().includes(q)) return false;
      }
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (statusFilter === 'active' && !d.isActive) return false;
      if (statusFilter === 'closed' && d.isActive) return false;
      return true;
    }),
    [drives, searchQuery, typeFilter, statusFilter],
  );

  const sortedCandidates = useMemo(() => {
    if (!selectedDrive) return [];
    const list = [...selectedDrive.registeredStudents];
    if (candidateSort === 'score') return list.sort((a, b) => b.innovationScore - a.innovationScore);
    if (candidateSort === 'name') return list.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return list.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());
  }, [selectedDrive, candidateSort]);

  const hackathonLeaderboard = useMemo(() =>
    selectedDrive
      ? [...selectedDrive.registeredStudents]
          .filter((s) => typeof s.submissionScore === 'number')
          .sort((a, b) => (b.submissionScore ?? 0) - (a.submissionScore ?? 0))
      : [],
    [selectedDrive],
  );

  const selectedRegistrant = selectedDrive?.registeredStudents.find((s) => s.studentId === submission.studentId) ?? null;

  const inviteToJobMutation = useMutation({
    mutationFn: ({ jobId, studentId, note }: { jobId: string; studentId: string; note: string }) =>
      recruiterApi.inviteStudentToJob(jobId, studentId, note ? { note } : undefined),
    onSuccess: () => setInviteDraft(null),
  });

  const canCreateDrive =
    Boolean(form.title.trim()) && Boolean(form.collegeId) && Boolean(form.scheduledAt) && Boolean(form.description.trim());

  const createDriveMutation = useMutation({
    mutationFn: () =>
      recruiterApi.createDrive({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        minimumInnovationScore: Number(form.minimumInnovationScore),
      }),
    onSuccess: async (createdDrive) => {
      setForm({ title: '', collegeId: '', type: 'Placement Drive', scheduledAt: '', description: '', minimumInnovationScore: 0 });
      setSubmitAttempted(false);
      setShowCreateModal(false);
      setSelectedDriveId(createdDrive._id);
      await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] });
    },
  });

  const closeDriveMutation = useMutation({
    mutationFn: recruiterApi.closeDrive,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] }); },
  });

  const submitScoreMutation = useMutation({
    mutationFn: () =>
      recruiterApi.submitDriveScore(selectedDrive!._id, {
        studentId: submission.studentId,
        submissionScore: Number(submission.submissionScore),
      }),
    onSuccess: async () => {
      setSubmission({ studentId: '', submissionScore: 0 });
      await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] });
    },
  });

  const handleSelectDrive = (driveId: string) => {
    setSelectedDriveId(driveId);
    setActiveTab('overview');
  };

  const closeModal = () => { setShowCreateModal(false); setSubmitAttempted(false); };

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      {!embedded && (
        <RecruiterSectionHeader
          eyebrow="Campus Hiring"
          title="Campus Drives"
          description="Launch recruitment drives at partner colleges, track registrations, and manage candidate pipelines."
          navItems={recruiterCampusSectionItems}
        />
      )}

      {/* Page title + CTA */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Drive Overview</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {metrics.total} drives · {metrics.active} active · {metrics.registrations} total registrations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Drive
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800">
              <ClipboardList className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{metrics.total}</div>
              <div className="text-xs text-slate-400">Total Drives</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Zap className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{metrics.active}</div>
              <div className="text-xs text-slate-400">Active Now</div>
            </div>
          </div>
          {metrics.total > 0 && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
              <div
                className="h-1.5 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.round((metrics.active / metrics.total) * 100)}%` }}
              />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
              <Users className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{metrics.registrations}</div>
              <div className="text-xs text-slate-400">Registrations</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Star className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{metrics.avgScore || '—'}</div>
              <div className="text-xs text-slate-400">Avg. Innovation Score</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main: Drive List + Detail Panel */}
      <div className="grid gap-5 xl:grid-cols-[340px,minmax(0,1fr)]">

        {/* Left: Drive List */}
        <div className="space-y-3">
          <Card className="p-3">
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drives or colleges..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="all">All types</option>
                  <option value="Placement Drive">Placement</option>
                  <option value="Internship Drive">Internship</option>
                  <option value="Hackathon">Hackathon</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </Card>

          {drivesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredDrives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-12 text-center">
              <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-600" />
              <div className="mt-3 text-sm font-medium text-slate-400">
                {drives.length === 0 ? 'No drives yet' : 'No drives match filters'}
              </div>
              {drives.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Create your first drive →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="px-1 text-xs text-slate-500">{filteredDrives.length} drive{filteredDrives.length !== 1 ? 's' : ''}</div>
              {filteredDrives.map((drive) => {
                const config = DRIVE_TYPE_CONFIG[drive.type];
                const { Icon } = config;
                const days = getDaysUntil(drive.scheduledAt);
                const isSelected = drive._id === selectedDriveId;

                return (
                  <button
                    key={drive._id}
                    onClick={() => handleSelectDrive(drive._id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400/40 bg-cyan-400/5 ring-1 ring-cyan-400/20'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{drive.title}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-400">{drive.collegeName}</div>
                          </div>
                          <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-700'}`} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${config.badgeClass}`}>
                            {config.label}
                          </span>
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                            drive.isActive
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-800/60 text-slate-500'
                          }`}>
                            {drive.isActive ? '● Active' : '○ Closed'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {drive.registeredStudents.length} students
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {days > 0 ? `${days}d away` : days === 0 ? 'Today' : 'Past'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div>
          {selectedDrive && selectedConfig ? (
            <Card className="xl:sticky xl:top-6 overflow-hidden">

              {/* Drive Header */}
              <div className={`border-b border-slate-800 px-6 py-5 ${selectedConfig.bg}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${selectedConfig.border} ${selectedConfig.bg}`}>
                      <selectedConfig.Icon className={`h-6 w-6 ${selectedConfig.color}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={selectedConfig.badgeClass}>{selectedConfig.label}</Badge>
                        <Badge className={
                          selectedDrive.isActive
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-700 bg-slate-800/60 text-slate-400'
                        }>
                          {selectedDrive.isActive ? '● Active' : '○ Closed'}
                        </Badge>
                      </div>
                      <h2 className="mt-1.5 text-xl font-semibold text-white">{selectedDrive.title}</h2>
                      <p className="mt-0.5 text-sm text-slate-400">{selectedDrive.collegeName}</p>
                    </div>
                  </div>
                  {selectedDrive.isActive && (
                    <Button
                      variant="secondary"
                      onClick={() => closeDriveMutation.mutate(selectedDrive._id)}
                      disabled={closeDriveMutation.isPending && closeDriveMutation.variables === selectedDrive._id}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {closeDriveMutation.isPending && closeDriveMutation.variables === selectedDrive._id
                        ? 'Closing...'
                        : 'Close Drive'}
                    </Button>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { value: selectedDrive.registeredStudents.length, label: 'Registered' },
                    { value: `${selectedDrive.minimumInnovationScore}+`, label: 'Min Score' },
                    {
                      value: daysUntilDrive !== null
                        ? daysUntilDrive > 0 ? `${daysUntilDrive}d` : daysUntilDrive === 0 ? 'Today' : 'Past'
                        : '—',
                      label: daysUntilDrive !== null && daysUntilDrive > 0 ? 'Until Drive' : 'Scheduled',
                    },
                  ].map(({ value, label }) => (
                    <div key={label} className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3">
                      <div className="text-lg font-bold text-white">{value}</div>
                      <div className="text-xs text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-slate-800 bg-slate-900/40">
                <nav className="flex gap-1 px-4 pt-1">
                  {(
                    [
                      { key: 'overview', label: 'Overview' },
                      { key: 'candidates', label: 'Candidates', count: selectedDrive.registeredStudents.length },
                      ...(selectedDrive.type === 'Hackathon'
                        ? [{ key: 'scores', label: 'Scores', count: hackathonLeaderboard.length }]
                        : []),
                    ] as Array<{ key: ActiveTab; label: string; count?: number }>
                  ).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === key
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {label}
                      {count !== undefined && (
                        <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Description</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{selectedDrive.description}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { Icon: GraduationCap, label: 'Host College', value: selectedDrive.collegeName },
                        { Icon: CalendarDays, label: 'Scheduled At', value: formatDriveDate(selectedDrive.scheduledAt) },
                        { Icon: Award, label: 'Min Innovation Score', value: `${selectedDrive.minimumInnovationScore} points` },
                        { Icon: Users, label: 'Total Registrations', value: `${selectedDrive.registeredStudents.length} students` },
                      ].map(({ Icon, label, value }) => (
                        <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </div>
                          <div className="mt-1.5 font-semibold text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Candidates Tab */}
                {activeTab === 'candidates' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-400">
                        {sortedCandidates.length} candidate{sortedCandidates.length !== 1 ? 's' : ''}
                      </div>
                      <select
                        value={candidateSort}
                        onChange={(e) => setCandidateSort(e.target.value as CandidateSort)}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
                      >
                        <option value="score">Sort: Score ↓</option>
                        <option value="name">Sort: Name A–Z</option>
                        <option value="date">Sort: Date ↑</option>
                      </select>
                    </div>

                    {sortedCandidates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-800 py-12 text-center">
                        <Users className="mx-auto h-8 w-8 text-slate-600" />
                        <div className="mt-3 text-sm text-slate-500">No students registered yet</div>
                      </div>
                    ) : (
                      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-800">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950">
                            <tr>
                              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">#</th>
                              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Student</th>
                              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Score</th>
                              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {sortedCandidates.map((student, index) => (
                              <tr key={student.studentId} className="transition-colors hover:bg-slate-800/30">
                                <td className="px-4 py-3 text-xs text-slate-500">{index + 1}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                                      {student.studentName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-medium text-white">{student.studentName}</div>
                                      {activeJobs.length > 0 && (
                                        <button
                                          onClick={() => setInviteDraft({
                                            studentId: student.studentId,
                                            studentName: student.studentName,
                                            jobId: activeJobs[0]._id,
                                            note: '',
                                          })}
                                          className="mt-0.5 flex items-center gap-1 text-[11px] text-cyan-400 transition-colors hover:text-cyan-300"
                                        >
                                          <Briefcase className="h-3 w-3" />
                                          Invite to job
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {typeof student.submissionScore === 'number' && (
                                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
                                        {student.submissionScore}pts
                                      </Badge>
                                    )}
                                    <span className="tabular-nums text-slate-300">{student.innovationScore}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">
                                  {new Date(student.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Scores Tab (Hackathon only) */}
                {activeTab === 'scores' && selectedDrive.type === 'Hackathon' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-[0.28em] text-amber-400">Submit Score</div>
                      <select
                        value={submission.studentId}
                        onChange={(e) => setSubmission((cur) => ({ ...cur, studentId: e.target.value }))}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      >
                        <option value="">Select participant</option>
                        {selectedDrive.registeredStudents.map((s) => (
                          <option key={s.studentId} value={s.studentId}>
                            {s.studentName} (Innovation: {s.innovationScore})
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        value={String(submission.submissionScore)}
                        onChange={(e) => setSubmission((cur) => ({ ...cur, submissionScore: Number(e.target.value) }))}
                        placeholder="Submission score (e.g. 87)"
                      />
                      {selectedRegistrant && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-slate-300">
                          Scoring{' '}
                          <span className="font-semibold text-white">{selectedRegistrant.studentName}</span>
                          {typeof selectedRegistrant.submissionScore === 'number' && (
                            <span className="text-slate-400"> · Current: {selectedRegistrant.submissionScore} pts</span>
                          )}
                        </div>
                      )}
                      <Button
                        onClick={() => submitScoreMutation.mutate()}
                        disabled={submitScoreMutation.isPending || !submission.studentId}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {submitScoreMutation.isPending ? 'Saving...' : 'Submit Score'}
                      </Button>
                    </div>

                    {hackathonLeaderboard.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Leaderboard · {hackathonLeaderboard.length} scored
                        </div>
                        <div className="space-y-2">
                          {hackathonLeaderboard.map((student, index) => (
                            <div
                              key={student.studentId}
                              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  index === 0 ? 'bg-amber-400 text-amber-900' :
                                  index === 1 ? 'bg-slate-400 text-slate-900' :
                                  index === 2 ? 'bg-amber-700 text-amber-100' :
                                  'bg-slate-800 text-slate-400'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{student.studentName}</div>
                                  <div className="text-xs text-slate-500">Innovation: {student.innovationScore}</div>
                                </div>
                              </div>
                              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                                {student.submissionScore} pts
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="flex min-h-[420px] flex-col items-center justify-center p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
                <BriefcaseBusiness className="h-8 w-8 text-slate-500" />
              </div>
              <div className="mt-4 text-lg font-semibold text-white">No Drive Selected</div>
              <p className="mt-2 max-w-xs text-sm text-slate-400">
                Select a drive from the list to view registrations and manage candidates.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-5 text-sm text-cyan-400 hover:text-cyan-300"
              >
                + Create your first drive
              </button>
            </Card>
          )}
        </div>
      </div>

      {/* Invite to Job Modal */}
      {inviteDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setInviteDraft(null); }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Invite to Job</div>
                <h3 className="mt-1 text-lg font-semibold text-white">{inviteDraft.studentName}</h3>
              </div>
              <button
                onClick={() => setInviteDraft(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              {activeJobs.length === 0 ? (
                <p className="text-sm text-slate-400">No active job postings. Open a job from the Marketplace first.</p>
              ) : (
                <>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-400">Job Posting</label>
                    <select
                      value={inviteDraft.jobId}
                      onChange={(e) => setInviteDraft((cur) => cur ? { ...cur, jobId: e.target.value } : null)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      {activeJobs.map((job) => (
                        <option key={job._id} value={job._id}>
                          {job.title} — {job.company}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-400">Note (optional)</label>
                    <Input
                      value={inviteDraft.note}
                      onChange={(e) => setInviteDraft((cur) => cur ? { ...cur, note: e.target.value } : null)}
                      placeholder="e.g. We think you'd be a great fit"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <Button variant="secondary" onClick={() => setInviteDraft(null)}>
                Cancel
              </Button>
              {activeJobs.length > 0 && (
                <Button
                  onClick={() => inviteToJobMutation.mutate(inviteDraft)}
                  disabled={inviteToJobMutation.isPending || !inviteDraft.jobId}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {inviteToJobMutation.isPending ? 'Sending...' : 'Send Invite'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Drive Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Campus Drives</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Launch a New Drive</h2>
              </div>
              <button
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto px-6 py-5">

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Drive Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((cur) => ({ ...cur, title: e.target.value }))}
                  placeholder="e.g. TechCorp Campus Placement 2025"
                  className={submitAttempted && !form.title.trim() ? 'border-red-500' : ''}
                />
                {submitAttempted && !form.title.trim() && <p className="text-xs text-red-400">Drive title is required.</p>}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Partner College *</label>
                <select
                  value={form.collegeId}
                  onChange={(e) => setForm((cur) => ({ ...cur, collegeId: e.target.value }))}
                  className={`w-full rounded-lg border bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none ${
                    submitAttempted && !form.collegeId
                      ? 'border-red-500'
                      : 'border-slate-800 focus:border-cyan-500/50'
                  }`}
                >
                  <option value="">Select a college</option>
                  {(collegesQuery.data ?? []).map((college) => (
                    <option key={college._id} value={college._id}>
                      {college.displayName}
                    </option>
                  ))}
                </select>
                {submitAttempted && !form.collegeId && <p className="text-xs text-red-400">College is required.</p>}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Drive Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Placement Drive', 'Internship Drive', 'Hackathon'] as const).map((type) => {
                    const config = DRIVE_TYPE_CONFIG[type];
                    const { Icon } = config;
                    const isActive = form.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((cur) => ({ ...cur, type }))}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                          isActive
                            ? `${config.border} ${config.bg} ${config.color}`
                            : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Scheduled Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((cur) => ({ ...cur, scheduledAt: e.target.value }))}
                  className={submitAttempted && !form.scheduledAt ? 'border-red-500' : ''}
                />
                {submitAttempted && !form.scheduledAt && <p className="text-xs text-red-400">Scheduled date is required.</p>}
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-400">Minimum Innovation Score</label>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                    Recommended
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={String(form.minimumInnovationScore)}
                  onChange={(e) => setForm((cur) => ({ ...cur, minimumInnovationScore: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-400">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
                  placeholder="Describe the drive, roles, expectations, and any special requirements..."
                  className={`min-h-28 w-full rounded-lg border bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none ${
                    submitAttempted && !form.description.trim()
                      ? 'border-red-500'
                      : 'border-slate-800 focus:border-cyan-500/50'
                  }`}
                />
                {submitAttempted && !form.description.trim() && <p className="text-xs text-red-400">Description is required.</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setSubmitAttempted(true);
                  if (canCreateDrive) createDriveMutation.mutate();
                }}
                disabled={createDriveMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {createDriveMutation.isPending ? 'Creating...' : 'Launch Drive'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
