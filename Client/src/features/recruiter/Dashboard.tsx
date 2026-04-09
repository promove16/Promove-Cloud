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
import { getStudentPortfolioViewPath } from '../marketplace/navigation';
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
  workMode: 'On-site' as const,
  salaryExpectation: '',
  experienceLevel: '',
  openings: '1',
  companyOverview: '',
  roleSummary: '',
  keyResponsibilities: '',
  requirements: '',
  benefits: '',
  applicationSteps: '',
  expiresAt: '',
};

const initialDriveForm = {
  title: '',
  collegeId: '',
  type: 'Placement Drive' as const,
  scheduledAt: '',
  description: '',
  minimumInnovationScore: '0',
};

const parseTextareaList = (value: string) =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function RecruiterDashboard() {
  const navigate = useNavigate();
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
      workMode: jobForm.workMode,
      salaryExpectation: jobForm.salaryExpectation.trim() || undefined,
      experienceLevel: jobForm.experienceLevel.trim() || undefined,
      openings: jobForm.openings ? Number(jobForm.openings) : undefined,
      companyOverview: jobForm.companyOverview.trim() || undefined,
      roleSummary: jobForm.roleSummary.trim() || undefined,
      keyResponsibilities: parseTextareaList(jobForm.keyResponsibilities),
      requirements: parseTextareaList(jobForm.requirements),
      benefits: parseTextareaList(jobForm.benefits),
      applicationSteps: parseTextareaList(jobForm.applicationSteps),
      expiresAt: jobForm.expiresAt ? new Date(jobForm.expiresAt).toISOString() : undefined,
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
                  <Button onClick={() => navigate(getStudentPortfolioViewPath(student._id))}>
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
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    value={jobForm.workMode}
                    onChange={(event) => setJobForm((current) => ({ ...current, workMode: event.target.value as typeof current.workMode }))}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white"
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                  <Input value={jobForm.salaryExpectation} onChange={(event) => setJobForm((current) => ({ ...current, salaryExpectation: event.target.value }))} placeholder="Salary expectation" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={jobForm.experienceLevel} onChange={(event) => setJobForm((current) => ({ ...current, experienceLevel: event.target.value }))} placeholder="Experience level" />
                  <Input value={jobForm.openings} onChange={(event) => setJobForm((current) => ({ ...current, openings: event.target.value }))} placeholder="Openings count" />
                </div>
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
                <textarea
                  value={jobForm.companyOverview}
                  onChange={(event) => setJobForm((current) => ({ ...current, companyOverview: event.target.value }))}
                  placeholder="About company"
                  className="min-h-24 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                />
                <textarea
                  value={jobForm.roleSummary}
                  onChange={(event) => setJobForm((current) => ({ ...current, roleSummary: event.target.value }))}
                  placeholder="Role summary"
                  className="min-h-24 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <textarea
                    value={jobForm.keyResponsibilities}
                    onChange={(event) => setJobForm((current) => ({ ...current, keyResponsibilities: event.target.value }))}
                    placeholder="Key responsibilities, one per line"
                    className="min-h-28 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                  />
                  <textarea
                    value={jobForm.requirements}
                    onChange={(event) => setJobForm((current) => ({ ...current, requirements: event.target.value }))}
                    placeholder="Requirements, one per line"
                    className="min-h-28 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <textarea
                    value={jobForm.benefits}
                    onChange={(event) => setJobForm((current) => ({ ...current, benefits: event.target.value }))}
                    placeholder="Benefits and perks, one per line"
                    className="min-h-24 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                  />
                  <textarea
                    value={jobForm.applicationSteps}
                    onChange={(event) => setJobForm((current) => ({ ...current, applicationSteps: event.target.value }))}
                    placeholder="Application steps, one per line"
                    className="min-h-24 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none"
                  />
                </div>
                <Input
                  type="datetime-local"
                  value={jobForm.expiresAt}
                  onChange={(event) => setJobForm((current) => ({ ...current, expiresAt: event.target.value }))}
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
