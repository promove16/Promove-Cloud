import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Eye, Plus, Send, Sparkles, XCircle } from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

export default function ActiveDrives() {
  const queryClient = useQueryClient();
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

  const drivesQuery = useQuery({
    queryKey: ['recruiter', 'drives'],
    queryFn: recruiterApi.getDrives,
  });

  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'colleges'],
    queryFn: recruiterApi.getColleges,
  });

  const selectedDrive = useMemo(
    () => drivesQuery.data?.find((drive) => drive._id === selectedDriveId) ?? null,
    [drivesQuery.data, selectedDriveId],
  );

  const closeDriveMutation = useMutation({
    mutationFn: recruiterApi.closeDrive,
    onSuccess: async () => {
      if (selectedDriveId) {
        setSelectedDriveId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['recruiter', 'drives'] });
    },
  });

  const createDrive = async () => {
    await recruiterApi.createDrive({
      ...form,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      minimumInnovationScore: Number(form.minimumInnovationScore),
    });
    setForm({
      title: '',
      collegeId: '',
      type: 'Placement Drive',
      scheduledAt: '',
      description: '',
      minimumInnovationScore: 0,
    });
    await drivesQuery.refetch();
  };

  const submitScore = async () => {
    if (!selectedDrive) return;
    await recruiterApi.submitDriveScore(selectedDrive._id, {
      studentId: submission.studentId,
      submissionScore: Number(submission.submissionScore),
    });
    setSubmission({ studentId: '', submissionScore: 0 });
    await drivesQuery.refetch();
  };

  const studentCount = selectedDrive?.registeredStudents.length ?? 0;
  const selectedRegistrant =
    selectedDrive?.registeredStudents.find((student) => student.studentId === submission.studentId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" />
          Active Drives
        </div>
        <h1 className="text-3xl font-bold text-white">Manage campus drives and registrations</h1>
        <p className="mt-2 text-slate-400">Create a drive, inspect registrations, and submit hackathon scores.</p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Create Drive</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Launch a new recruitment drive</h2>
          </div>
          <Button onClick={createDrive}>
            <Plus className="mr-2 h-4 w-4" />
            Create Drive
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Drive title" />
          <select
            value={form.collegeId}
            onChange={(event) => setForm((current) => ({ ...current, collegeId: event.target.value }))}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="">Select college</option>
            {(collegesQuery.data ?? []).map((college) => (
              <option key={college._id} value={college._id}>
                {college.displayName}
              </option>
            ))}
          </select>
          <select
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as typeof form.type }))}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="Placement Drive">Placement Drive</option>
            <option value="Internship Drive">Internship Drive</option>
            <option value="Hackathon">Hackathon</option>
          </select>
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
          />
          <Input
            type="number"
            value={String(form.minimumInnovationScore)}
            onChange={(event) => setForm((current) => ({ ...current, minimumInnovationScore: Number(event.target.value) }))}
            placeholder="Minimum score"
          />
          <Input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Drive description"
          />
        </div>
      </Card>

      {drivesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {(drivesQuery.data ?? []).map((drive) => (
            <Card key={drive._id} className="p-5">
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
                    <Badge className={drive.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}>
                      {drive.isActive ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{drive.registeredStudents.length}</div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Students</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setSelectedDriveId(drive._id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Registrations
                </Button>
                {drive.isActive ? (
                  <Button variant="secondary" onClick={() => closeDriveMutation.mutate(drive._id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Drive
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedDrive ? (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Drive Detail</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{selectedDrive.title}</h2>
            </div>
            <Button variant="secondary" onClick={() => setSelectedDriveId(null)}>
              Close
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <div className="text-2xl font-bold text-white">{studentCount}</div>
              <div className="mt-1 text-sm text-slate-400">Registered students</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-white">{selectedDrive.collegeName}</div>
              <div className="mt-1 text-sm text-slate-400">Host college</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-white">{selectedDrive.minimumInnovationScore}+</div>
              <div className="mt-1 text-sm text-slate-400">Minimum score</div>
            </Card>
          </div>
          <div className="mt-5 space-y-3">
            {selectedDrive.registeredStudents.map((student) => (
              <div key={student.studentId} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-white">{student.studentName}</div>
                  <div className="mt-1 text-sm text-slate-400">{student.innovationScore} score</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                    {new Date(student.registeredAt).toLocaleDateString('en-IN')}
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
          {selectedDrive.type === 'Hackathon' ? (
            <>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <select
                  value={submission.studentId}
                  onChange={(event) => setSubmission((current) => ({ ...current, studentId: event.target.value }))}
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
                  value={String(submission.submissionScore)}
                  onChange={(event) => setSubmission((current) => ({ ...current, submissionScore: Number(event.target.value) }))}
                  placeholder="Submission score"
                />
              </div>
              {selectedRegistrant ? (
                <div className="mt-3 text-sm text-slate-400">
                  Scoring <span className="font-semibold text-white">{selectedRegistrant.studentName}</span>
                </div>
              ) : null}
              <div className="mt-4 flex justify-end">
                <Button onClick={submitScore} disabled={!submission.studentId}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Score
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
