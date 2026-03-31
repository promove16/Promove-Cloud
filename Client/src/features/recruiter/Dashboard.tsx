import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BriefcaseBusiness, Building2, Calendar, Eye, Search, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../app/components/ui/dialog';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { StudentProfileDrawer } from './StudentProfileDrawer';
import { PatentShowcase } from '../shared/PatentShowcase';

type ModalMode = 'job' | 'search' | 'drive' | null;

const initialJobForm = {
  title: '',
  company: '',
  description: '',
  domain: '',
  minimumInnovationScore: '0',
  type: 'Full-time' as const,
  location: '',
};

const initialDriveForm = {
  title: '',
  collegeId: '',
  type: 'Placement Drive' as const,
  scheduledAt: '',
  description: '',
  minimumInnovationScore: '0',
};

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [driveForm, setDriveForm] = useState(initialDriveForm);
  const [searchTerm, setSearchTerm] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['recruiter', 'dashboard'],
    queryFn: recruiterApi.getDashboard,
  });

  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'colleges'],
    queryFn: recruiterApi.getColleges,
    enabled: modalMode === 'drive',
  });

  const dashboard = dashboardQuery.data;

  const handleShortlist = async (studentId: string) => {
    await recruiterApi.shortlistStudent(studentId);
    await dashboardQuery.refetch();
  };

  const submitJob = async () => {
    await recruiterApi.createJob({
      title: jobForm.title,
      company: jobForm.company,
      description: jobForm.description,
      domain: jobForm.domain,
      minimumInnovationScore: Number(jobForm.minimumInnovationScore),
      type: jobForm.type,
      location: jobForm.location,
    });
    setJobForm(initialJobForm);
    setModalMode(null);
    await dashboardQuery.refetch();
  };

  const submitDrive = async () => {
    await recruiterApi.createDrive({
      title: driveForm.title,
      collegeId: driveForm.collegeId,
      type: driveForm.type,
      scheduledAt: new Date(driveForm.scheduledAt).toISOString(),
      description: driveForm.description,
      minimumInnovationScore: Number(driveForm.minimumInnovationScore),
    });
    setDriveForm(initialDriveForm);
    setModalMode(null);
    await dashboardQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <Sparkles className="h-4 w-4" />
            Recruiter Dashboard
          </div>
          <h1 className="text-3xl font-bold text-white">Your hiring command center</h1>
          <p className="mt-2 text-slate-400">Shortlist talent, launch drives, and manage the onboarding flow.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalMode('job')}>
            <BriefcaseBusiness className="mr-2 h-4 w-4" />
            Post a Job
          </Button>
          <Button variant="secondary" onClick={() => setModalMode('search')}>
            <Search className="mr-2 h-4 w-4" />
            Search Talent
          </Button>
          <Button variant="secondary" onClick={() => setModalMode('drive')}>
            <Building2 className="mr-2 h-4 w-4" />
            Start a Campus Drive
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {([
          ['Open Positions', dashboard?.openPositions ?? 0, BriefcaseBusiness],
          ['Shortlisted This Week', dashboard?.shortlistedThisWeek ?? 0, ShieldCheck],
          ['Active Campus Drives', dashboard?.activeDrives ?? 0, Calendar],
          ['Score Match Candidates', dashboard?.newScoreMatchCandidates ?? 0, Users],
        ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
          <Card key={label as string} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-3xl font-bold text-white">{value as number}</div>
                <div className="mt-2 text-sm text-slate-400">{label as string}</div>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">New Matches</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Students with strong score overlap</h2>
          </div>
          <Badge>{dashboard?.newMatches.length ?? 0} candidates</Badge>
        </div>

        {dashboardQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {dashboard?.newMatches.map((student) => (
              <Card key={student._id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-lg font-bold text-white">
                      {student.avatar ? (
                        <img src={student.avatar} alt={student.displayName} className="h-14 w-14 rounded-2xl object-cover" />
                      ) : (
                        student.displayName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-white">{student.displayName}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {student.institution?.name ?? 'Independent'} - {student.headline}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {student.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} className="border-slate-700 bg-slate-900 text-slate-300">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{student.innovationScore}</div>
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Innovation Score</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => setSelectedStudentId(student._id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Profile
                  </Button>
                  <Button variant="secondary" onClick={() => handleShortlist(student._id)}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Shortlist
                  </Button>
                  {student.canContact ? (
                    <Button variant="secondary" onClick={() => navigate(`/dashboard/recruiter/messages/${student._id}`)}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Message
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PatentShowcase />

      <StudentProfileDrawer
        studentId={selectedStudentId}
        open={Boolean(selectedStudentId)}
        onClose={() => setSelectedStudentId(null)}
        onChanged={() => dashboardQuery.refetch()}
      />

      <Dialog open={modalMode !== null} onOpenChange={(open: boolean) => setModalMode(open ? modalMode : null)}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-white">
          {modalMode === 'job' ? (
            <>
              <DialogHeader>
                <DialogTitle>Post a Job</DialogTitle>
                <DialogDescription>Publish a new opening and optionally auto-match students by score.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} placeholder="Title" />
                <Input value={jobForm.company} onChange={(event) => setJobForm((current) => ({ ...current, company: event.target.value }))} placeholder="Company" />
                <Input value={jobForm.domain} onChange={(event) => setJobForm((current) => ({ ...current, domain: event.target.value }))} placeholder="Domain" />
                <Input value={jobForm.location} onChange={(event) => setJobForm((current) => ({ ...current, location: event.target.value }))} placeholder="Location" />
                <Input value={jobForm.minimumInnovationScore} onChange={(event) => setJobForm((current) => ({ ...current, minimumInnovationScore: event.target.value }))} placeholder="Minimum innovation score" />
                <select
                  value={jobForm.type}
                  onChange={(event) => setJobForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Internship">Internship</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time">Part-time</option>
                </select>
                <textarea
                  value={jobForm.description}
                  onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Job description"
                  className="min-h-28 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setModalMode(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitJob}
                  disabled={
                    !jobForm.title.trim() ||
                    !jobForm.company.trim() ||
                    !jobForm.description.trim() ||
                    !jobForm.domain.trim() ||
                    !jobForm.location.trim()
                  }
                >
                  Create Job
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {modalMode === 'search' ? (
            <>
              <DialogHeader>
                <DialogTitle>Search Talent</DialogTitle>
                <DialogDescription>Jump into the full talent workspace with a quick search prompt.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name, domain, or college" />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setModalMode(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setModalMode(null);
                    navigate('/dashboard/recruiter/talent');
                  }}
                >
                  Open Talent Search
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {modalMode === 'drive' ? (
            <>
              <DialogHeader>
                <DialogTitle>Start a Campus Drive</DialogTitle>
                <DialogDescription>Create a placement or internship drive for a partner college.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input value={driveForm.title} onChange={(event) => setDriveForm((current) => ({ ...current, title: event.target.value }))} placeholder="Drive title" />
                <select
                  value={driveForm.collegeId}
                  onChange={(event) => setDriveForm((current) => ({ ...current, collegeId: event.target.value }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="">Select college</option>
                  {(collegesQuery.data ?? []).map((college) => (
                    <option key={college._id} value={college._id}>
                      {college.displayName}
                    </option>
                  ))}
                </select>
                <select
                  value={driveForm.type}
                  onChange={(event) => setDriveForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Internship Drive">Internship Drive</option>
                  <option value="Hackathon">Hackathon</option>
                </select>
                <Input
                  type="datetime-local"
                  value={driveForm.scheduledAt}
                  onChange={(event) => setDriveForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                />
                <Input
                  value={driveForm.minimumInnovationScore}
                  onChange={(event) => setDriveForm((current) => ({ ...current, minimumInnovationScore: event.target.value }))}
                  placeholder="Minimum innovation score"
                />
                <textarea
                  value={driveForm.description}
                  onChange={(event) => setDriveForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Drive description"
                  className="min-h-28 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setModalMode(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitDrive}
                  disabled={
                    !driveForm.title.trim() ||
                    !driveForm.collegeId.trim() ||
                    !driveForm.description.trim() ||
                    !driveForm.scheduledAt.trim()
                  }
                >
                  Create Drive
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
