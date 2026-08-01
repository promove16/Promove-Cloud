import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MessageCircle, Pin, Search, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { mentorApi, MentorFeedStudent } from '../../api/mentor.api';
import { getMentorSocket } from '../../lib/socket';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { getApiErrorMessage } from '../../utils/apiError';
import { StudentProfileDrawer } from './StudentProfileDrawer';

type SessionFormState = {
  studentId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  workspaceId: string;
  meetLink: string;
};

type Notice = {
  tone: 'success' | 'error';
  text: string;
};

type MentorWatchResponse = {
  success: boolean;
  message?: string;
};

const emptySessionForm = (studentId = ''): SessionFormState => ({
  studentId,
  title: '',
  scheduledAt: '',
  durationMinutes: 45,
  workspaceId: '',
  meetLink: '',
});

function ScheduleModal({
  open,
  students,
  value,
  onClose,
  onChange,
  onSubmit,
  busy,
}: {
  open: boolean;
  students: MentorFeedStudent[];
  value: SessionFormState;
  onClose: () => void;
  onChange: (next: SessionFormState) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Schedule Session</div>
            <h3 className="mt-2 text-2xl font-bold text-white">New mentor session</h3>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <select
            className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            value={value.studentId}
            onChange={(event) => {
              const selectedStudent = students.find((student) => student.studentId === event.target.value);
              onChange({
                ...value,
                studentId: event.target.value,
                workspaceId: selectedStudent?.workspaceId ?? '',
              });
            }}
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.displayName} - {student.startupName}
              </option>
            ))}
          </select>
          <Input
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            placeholder="Session title"
          />
          <Input
            type="datetime-local"
            value={value.scheduledAt}
            onChange={(event) => onChange({ ...value, scheduledAt: event.target.value })}
          />
          <select
            className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            value={value.durationMinutes}
            onChange={(event) => onChange({ ...value, durationMinutes: Number(event.target.value) })}
          >
            {[30, 45, 60, 90].map((duration) => (
              <option key={duration} value={duration}>
                {duration} minutes
              </option>
            ))}
          </select>
          <Input
            value={value.workspaceId}
            onChange={(event) => onChange({ ...value, workspaceId: event.target.value })}
            placeholder="Workspace ID (optional)"
          />
          <Input
            value={value.meetLink}
            onChange={(event) => onChange({ ...value, meetLink: event.target.value })}
            placeholder="Google Meet URL (optional)"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onSubmit} disabled={busy || !value.studentId || !value.title || !value.scheduledAt}>
            {busy ? 'Scheduling...' : 'Schedule Session'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function StudentFeed() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(params.id ?? null);
  const [scheduleStudentId, setScheduleStudentId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(emptySessionForm());
  const [notice, setNotice] = useState<Notice | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['mentor-students'],
    queryFn: mentorApi.getStudents,
    refetchInterval: 60_000,
  });

  const scheduleMutation = useMutation({
    mutationFn: mentorApi.createSession,
    onSuccess: async () => {
      setNotice({ tone: 'success', text: 'Session scheduled successfully.' });
      setScheduleStudentId(null);
      setSessionForm(emptySessionForm());
      await queryClient.invalidateQueries({ queryKey: ['mentor-sessions'] });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        text: getApiErrorMessage(error, 'Unable to schedule this session right now.'),
      });
    },
  });

  const toggleWatchMutation = useMutation({
    mutationFn: async ({ studentId, watched }: { studentId: string; watched: boolean }) => {
      const socket = getMentorSocket();
      if (!socket.connected) {
        socket.connect();
      }

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(
          () => reject(new Error('The pin request timed out. Please try again.')),
          8_000,
        );

        socket.emit(
          watched ? 'mentor:unwatch' : 'mentor:watch',
          { studentId },
          (response: MentorWatchResponse) => {
            window.clearTimeout(timeoutId);
            if (response.success) {
              resolve();
              return;
            }
            reject(new Error(response.message ?? 'Unable to update this student pin.'));
          },
        );
      });
    },
    onSuccess: async (_data, variables) => {
      setNotice({
        tone: 'success',
        text: variables.watched ? 'Student unpinned.' : 'Student pinned to your live feed.',
      });
      await queryClient.invalidateQueries({ queryKey: ['mentor-students'] });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to update this student pin.',
      });
    },
  });

  useEffect(() => {
    setSelectedStudentId(params.id ?? null);
  }, [params.id]);

  useEffect(() => {
    const socket = getMentorSocket();
    const handleMentorError = ({ message: socketMessage }: { message?: string }) => {
      setNotice({
        tone: 'error',
        text: socketMessage ?? 'Live mentor feed is temporarily unavailable.',
      });
    };

    socket.on('mentor:error', handleMentorError);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('mentor:error', handleMentorError);
    };
  }, []);

  const students = useMemo(
    () => {
      const filtered = (studentsQuery.data ?? []).filter((student) =>
        `${student.displayName} ${student.startupName} ${student.category} ${student.recentActivitySummary}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
      return [...filtered].sort((a, b) => {
        if (a.isWatched && !b.isWatched) return -1;
        if (!a.isWatched && b.isWatched) return 1;
        return 0;
      });
    },
    [studentsQuery.data, search],
  );

  const openSchedule = (studentId: string) => {
    const selectedStudent = studentsQuery.data?.find((student) => student.studentId === studentId);
    setScheduleStudentId(studentId);
    setSessionForm((current) => ({
      ...current,
      studentId,
      workspaceId: selectedStudent?.workspaceId ?? '',
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student Feed</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Students routed to you</h1>
          <p className="mt-2 text-slate-400">This feed is limited to students attached to your admin-assigned project workspaces. Pinning a student keeps their live score activity flowing into your dashboard.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search students or startups"
            className="pl-11"
          />
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {studentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : studentsQuery.isError ? (
        <Card className="border-rose-500/20 p-6 text-sm text-rose-200">
          {getApiErrorMessage(studentsQuery.error, 'Unable to load your assigned students right now.')}
        </Card>
      ) : students.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          {search
            ? 'No assigned students match your search.'
            : 'No students are assigned to your mentor workspaces yet.'}
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {students.map((student) => (
          <Card 
            key={student._id} 
            className={`p-5 transition-all duration-300 relative ${
              student.isWatched 
                ? 'border-cyan-500/50 bg-slate-900/60 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/20 scale-[1.01]' 
                : 'hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-xl font-bold text-white">
                  {student.avatar ? (
                    <img src={student.avatar} alt={student.displayName} className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    student.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-semibold text-white">{student.displayName}</div>
                    <button
                      type="button"
                      disabled={toggleWatchMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchMutation.mutate({ studentId: student.studentId, watched: student.isWatched });
                      }}
                      className={`p-1.5 rounded-lg transition-all duration-300 ${
                        student.isWatched 
                          ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10' 
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                      title={student.isWatched ? 'Unpin student' : 'Pin student'}
                    >
                      <Pin className={`h-4 w-4 transition-transform duration-300 hover:scale-110 active:scale-95 ${student.isWatched ? 'fill-cyan-400 stroke-cyan-400 rotate-45' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-cyan-300">{student.startupName}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{student.category}</Badge>
                    <Badge>{student.innovationScore}/{MAX_INNOVATION_SCORE}</Badge>
                    <Badge>{student.isWatched ? 'Pinned' : 'Assigned'}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{student.recentActivitySummary}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={() => setSelectedStudentId(student.studentId)}>
                  <UserRound className="mr-2 h-4 w-4" />
                  View Mentee
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/dashboard/messages/${student.studentId}`)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message Student
                </Button>
                <Button variant="secondary" onClick={() => openSchedule(student.studentId)}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Schedule Session
                </Button>
              </div>
            </div>
          </Card>
          ))}
        </div>
      )}

      <StudentProfileDrawer
        open={Boolean(selectedStudentId)}
        studentId={selectedStudentId}
        onClose={() => {
          setSelectedStudentId(null);
          navigate('/dashboard/mentor/students', { replace: true });
        }}
        onSchedule={(studentId) => openSchedule(studentId)}
      />

      <ScheduleModal
        open={Boolean(scheduleStudentId)}
        students={studentsQuery.data ?? []}
        value={sessionForm}
        onClose={() => setScheduleStudentId(null)}
        onChange={setSessionForm}
        busy={scheduleMutation.isPending}
        onSubmit={() =>
          scheduleMutation.mutate({
            studentId: sessionForm.studentId,
            workspaceId: sessionForm.workspaceId || undefined,
            title: sessionForm.title,
            scheduledAt: new Date(sessionForm.scheduledAt).toISOString(),
            durationMinutes: sessionForm.durationMinutes,
            meetLink: sessionForm.meetLink || undefined,
          })
        }
      />
    </div>
  );
}
