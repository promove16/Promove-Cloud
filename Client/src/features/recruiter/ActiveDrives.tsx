import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Eye, Plus, Send, Users, XCircle } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterDriveSectionItems,
} from './RecruiterSectionNav';

type ActiveDrivesProps = {
  embedded?: boolean;
};

const formatDriveDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ActiveDrives({ embedded = false }: ActiveDrivesProps) {
  const queryClient = useQueryClient();
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    collegeId: '',
    type: 'Placement Drive' as 'Placement Drive' | 'Internship Drive' | 'Hackathon',
    scheduledAt: '',
    description: '',
    minimumInnovationScore: 0,
  });
  const [submission, setSubmission] = useState({ studentId: '', submissionScore: 0 });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const drivesQuery = useQuery({
    queryKey: ['recruiter', 'drives'],
    queryFn: recruiterApi.getDrives,
  });

  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'colleges'],
    queryFn: recruiterApi.getColleges,
  });

  const drives = drivesQuery.data ?? [];

  useEffect(() => {
    if (drives.length === 0) {
      setSelectedDriveId(null);
      return;
    }

    if (!selectedDriveId || !drives.some((drive) => drive._id === selectedDriveId)) {
      setSelectedDriveId(drives[0]._id);
    }
  }, [drives, selectedDriveId]);

  const selectedDrive = useMemo(
    () => drives.find((drive) => drive._id === selectedDriveId) ?? null,
    [drives, selectedDriveId],
  );

  const driveMetrics = useMemo(
    () => ({
      total: drives.length,
      active: drives.filter((drive) => drive.isActive).length,
      registrations: drives.reduce((sum, drive) => sum + drive.registeredStudents.length, 0),
    }),
    [drives],
  );

  const createDriveMutation = useMutation({
    mutationFn: () =>
      recruiterApi.createDrive({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        minimumInnovationScore: Number(form.minimumInnovationScore),
      }),
    onSuccess: async (createdDrive) => {
      setForm({
        title: '',
        collegeId: '',
        type: 'Placement Drive',
        scheduledAt: '',
        description: '',
        minimumInnovationScore: 0,
      });
      setSubmitAttempted(false);
      setSelectedDriveId(createdDrive._id);
      await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] });
    },
  });

  const closeDriveMutation = useMutation({
    mutationFn: recruiterApi.closeDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] });
    },
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

  const selectedRegistrant =
    selectedDrive?.registeredStudents.find((student) => student.studentId === submission.studentId) ?? null;

  const handleSelectDrive = (driveId: string) => {
    setSelectedDriveId(driveId);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const canCreateDrive =
    Boolean(form.title.trim()) &&
    Boolean(form.collegeId) &&
    Boolean(form.scheduledAt) &&
    Boolean(form.description.trim());

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      {!embedded ? (
        <RecruiterSectionHeader
          eyebrow="Drive Workspace"
          title="Manage campus drives and registrations"
          description="Create recruitment drives, review registrations, and work through candidate participation from a single surface."
          navItems={recruiterDriveSectionItems}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Create Drive</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Launch a new recruitment drive</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Set the college, threshold, and schedule. New drives appear immediately in the recruiter list.
              </p>
            </div>
            <Badge className="border-slate-700 bg-slate-950 text-slate-300">
              {(collegesQuery.data ?? []).length} colleges
            </Badge>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-1">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Drive title"
                className={submitAttempted && !form.title.trim() ? 'border-red-500 focus:border-red-500' : ''}
              />
              {submitAttempted && !form.title.trim() && (
                <p className="text-xs text-red-400">Drive title is required.</p>
              )}
            </div>

            <div className="grid gap-1">
              <select
                value={form.collegeId}
                onChange={(event) => setForm((current) => ({ ...current, collegeId: event.target.value }))}
                className={`w-full rounded-lg border bg-slate-950 px-4 py-3 text-white ${
                  submitAttempted && !form.collegeId ? 'border-red-500' : 'border-slate-800'
                }`}
              >
                <option value="">Select college</option>
                {(collegesQuery.data ?? []).map((college) => (
                  <option key={college._id} value={college._id}>
                    {college.displayName}
                  </option>
                ))}
              </select>
              {submitAttempted && !form.collegeId && (
                <p className="text-xs text-red-400">College selection is required.</p>
              )}
            </div>

            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({ ...current, type: event.target.value as typeof form.type }))
              }
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="Placement Drive">Placement Drive</option>
              <option value="Internship Drive">Internship Drive</option>
              <option value="Hackathon">Hackathon</option>
            </select>

            <div className="grid gap-1">
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                className={submitAttempted && !form.scheduledAt ? 'border-red-500 focus:border-red-500' : ''}
              />
              {submitAttempted && !form.scheduledAt && (
                <p className="text-xs text-red-400">Scheduled date and time is required.</p>
              )}
            </div>

            <Input
              type="number"
              min={0}
              value={String(form.minimumInnovationScore)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minimumInnovationScore: Number(event.target.value),
                }))
              }
              placeholder="Minimum score"
            />

            <div className="grid gap-1">
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Drive description"
                className={`min-h-32 rounded-lg border bg-slate-950 px-4 py-3 text-white ${
                  submitAttempted && !form.description.trim() ? 'border-red-500' : 'border-slate-800'
                }`}
              />
              {submitAttempted && !form.description.trim() && (
                <p className="text-xs text-red-400">Drive description is required.</p>
              )}
            </div>
          </div>
          <div className="sticky bottom-0 -mx-6 mt-6 border-t border-slate-800 bg-slate-900 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                Review the schedule and threshold, then create the drive.
              </p>
              <Button
                onClick={() => {
                  setSubmitAttempted(true);
                  if (canCreateDrive) {
                    createDriveMutation.mutate();
                  }
                }}
                disabled={createDriveMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {createDriveMutation.isPending ? 'Creating...' : 'Create Drive'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveMetrics.total}</div>
                  <div className="text-sm text-slate-400">Total drives</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveMetrics.active}</div>
                  <div className="text-sm text-slate-400">Active now</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{driveMetrics.registrations}</div>
                  <div className="text-sm text-slate-400">Registrations</div>
                </div>
              </div>
            </Card>
          </div>

          <div ref={detailRef}>
            <Card className="p-6">
              {selectedDrive ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Selected Drive</div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{selectedDrive.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{selectedDrive.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          {selectedDrive.type}
                        </Badge>
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          {selectedDrive.minimumInnovationScore}+ score
                        </Badge>
                        <Badge
                          className={
                            selectedDrive.isActive
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }
                        >
                          {selectedDrive.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                    </div>

                    {selectedDrive.isActive ? (
                      <Button
                        variant="secondary"
                        onClick={() => closeDriveMutation.mutate(selectedDrive._id)}
                        disabled={
                          closeDriveMutation.isPending &&
                          closeDriveMutation.variables === selectedDrive._id
                        }
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {closeDriveMutation.isPending &&
                        closeDriveMutation.variables === selectedDrive._id
                          ? 'Closing...'
                          : 'Close Drive'}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="p-4">
                      <div className="text-lg font-semibold text-white">{selectedDrive.collegeName}</div>
                      <div className="mt-1 text-sm text-slate-400">Host college</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-lg font-semibold text-white">
                        {formatDriveDate(selectedDrive.scheduledAt)}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">Scheduled time</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-lg font-semibold text-white">
                        {selectedDrive.registeredStudents.length}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">Registered students</div>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950">
                      <div className="border-b border-slate-800 px-5 py-4">
                        <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                          Registrations
                        </div>
                      </div>

                      {selectedDrive.registeredStudents.length ? (
                        <div className="divide-y divide-slate-800">
                          {selectedDrive.registeredStudents.map((student) => (
                            <div
                              key={student.studentId}
                              className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <div className="font-semibold text-white">{student.studentName}</div>
                                <div className="mt-1 text-sm text-slate-400">
                                  Innovation score {student.innovationScore} | Registered{' '}
                                  {new Date(student.registeredAt).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                                  {selectedDrive.type}
                                </Badge>
                                {typeof student.submissionScore === 'number' ? (
                                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                                    {student.submissionScore} pts
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-5 py-10 text-sm text-slate-500">
                          No students have registered for this drive yet.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {selectedDrive.type === 'Hackathon' ? (
                        <Card className="p-5">
                          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                            Score Submission
                          </div>
                          <div className="mt-4 grid gap-3">
                            <select
                              value={submission.studentId}
                              onChange={(event) =>
                                setSubmission((current) => ({
                                  ...current,
                                  studentId: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            >
                              <option value="">Select registered student</option>
                              {selectedDrive.registeredStudents.map((student) => (
                                <option key={student.studentId} value={student.studentId}>
                                  {student.studentName} ({student.innovationScore})
                                </option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              min={0}
                              value={String(submission.submissionScore)}
                              onChange={(event) =>
                                setSubmission((current) => ({
                                  ...current,
                                  submissionScore: Number(event.target.value),
                                }))
                              }
                              placeholder="Submission score"
                            />
                            {selectedRegistrant ? (
                              <div className="rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
                                Scoring{' '}
                                <span className="font-semibold text-white">
                                  {selectedRegistrant.studentName}
                                </span>
                              </div>
                            ) : null}
                            <Button
                              onClick={() => submitScoreMutation.mutate()}
                              disabled={submitScoreMutation.isPending || !submission.studentId}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {submitScoreMutation.isPending ? 'Saving...' : 'Submit Score'}
                            </Button>
                          </div>
                        </Card>
                      ) : (
                        <Card className="p-5">
                          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                            Drive Status
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-400">
                            Registration details stay visible here as students join the drive. Hackathon drives also
                            support submission scoring in this panel.
                          </p>
                        </Card>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="text-lg font-semibold text-white">No drive selected</div>
                  <p className="mt-2 text-sm text-slate-400">
                    Pick a drive to inspect registrations and manage activity.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Drive List</div>
            <h2 className="mt-2 text-xl font-semibold text-white">All recruiter drives</h2>
          </div>
          <Badge className="border-slate-700 bg-slate-950 text-slate-300">{drives.length} total</Badge>
        </div>

        {drivesQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : drives.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drives.map((drive) => {
              const isSelected = drive._id === selectedDriveId;

              return (
                <Card
                  key={drive._id}
                  className={`p-5 transition ${
                    isSelected ? 'border-cyan-400/40 bg-cyan-400/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-semibold text-white">{drive.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{drive.collegeName}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">{drive.type}</Badge>
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          {drive.minimumInnovationScore}+ score
                        </Badge>
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          {drive.registeredStudents.length} registrations
                        </Badge>
                        <Badge
                          className={
                            drive.isActive
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }
                        >
                          {drive.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{drive.registeredStudents.length}</div>
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Students</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-500">{formatDriveDate(drive.scheduledAt)}</div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => handleSelectDrive(drive._id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {isSelected ? 'Viewing registrations' : 'View Registrations'}
                    </Button>
                    {drive.isActive ? (
                      <Button
                        variant="secondary"
                        onClick={() => closeDriveMutation.mutate(drive._id)}
                        disabled={
                          closeDriveMutation.isPending && closeDriveMutation.variables === drive._id
                        }
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Close Drive
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-sm text-slate-500">
            No recruiter drives yet. Create one from the form above to start collecting registrations.
          </div>
        )}
      </Card>
    </div>
  );
}
