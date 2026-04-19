import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Medal, Search, Zap } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';
import { StudentJourneyDrawerBase } from './StudentJourneyDrawerBase';
import { getScoreSocket } from '../../lib/socket';
import {
  LeaderboardPage,
  StudentJourney,
  StudentLeaderboardItem,
} from '../../types/school.types';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';

type Props = {
  mode: 'school' | 'college';
  title: string;
  subtitle: string;
  basePath: string;
  fetchPage: (cursor?: string) => Promise<LeaderboardPage>;
  fetchJourney: (studentId: string) => Promise<StudentJourney>;
  headerAction?: ReactNode;
  prelude?: ReactNode;
  sidePanel?: ReactNode;
};

const medalColorMap: Record<number, string> = {
  1: 'text-amber-300',
  2: 'text-slate-300',
  3: 'text-orange-300',
};

const rankRowAccent: Record<number, string> = {
  1: 'border-l-2 border-l-amber-400/50 bg-amber-500/[0.03]',
  2: 'border-l-2 border-l-slate-400/30 bg-slate-300/[0.03]',
  3: 'border-l-2 border-l-orange-400/30 bg-orange-500/[0.03]',
};

const stagePillStyle: Record<string, string> = {
  Idea: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  Problem: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Build: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  Patent: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Launch: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

export function LeaderboardPageBase({
  mode,
  title,
  basePath,
  fetchPage,
  fetchJourney,
  headerAction,
  prelude,
  sidePanel,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ id?: string }>();
  const selectedStudentId = params.id;
  const [search, setSearch] = useState('');
  const [isLive, setIsLive] = useState(false);

  const leaderboardQuery = useInfiniteQuery({
    queryKey: ['institution-leaderboard', mode],
    queryFn: ({ pageParam }) => fetchPage(pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    refetchInterval: 60_000,
  });

  const journeyQuery = useQuery({
    queryKey: ['student-journey', mode, selectedStudentId],
    queryFn: () => fetchJourney(selectedStudentId!),
    enabled: Boolean(selectedStudentId),
  });

  useEffect(() => {
    const socket = getScoreSocket();
    if (!socket.connected) socket.connect();

    const handleScoreUpdate = () => {
      setIsLive(true);
      setTimeout(() => setIsLive(false), 2000);
      void queryClient.invalidateQueries({ queryKey: ['institution-leaderboard', mode] });
    };

    socket.on('score:updated', handleScoreUpdate);
    return () => {
      socket.off('score:updated', handleScoreUpdate);
    };
  }, [mode, queryClient]);

  const students = useMemo(
    () => leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [leaderboardQuery.data],
  );

  const filteredStudents = students.filter((student) =>
    student.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="space-y-5">
        {prelude}

        <InstitutionWorkspaceHeader
          mode={mode}
          eyebrow="Students"
          title={title}
          headerAction={headerAction}
          showMenu={false}
          tabsAction={
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-500 ${
                  isLive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                <Zap className="h-3 w-3" />
                Live
              </div>
              <div className="relative w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="pl-9 text-sm"
                />
              </div>
            </div>
          }
        />

        <div
          className={
            sidePanel
              ? 'grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.75fr)]'
              : undefined
          }
        >
          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              <div className="grid grid-cols-[56px,1fr,172px,96px] gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                <div className="text-center">#</div>
                <div>Student</div>
                <div>Score</div>
                <div />
              </div>

              <div className="divide-y divide-slate-800/50">
                {leaderboardQuery.isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    {search ? 'No students match your search' : 'No students yet'}
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <StudentRow
                      key={student._id}
                      student={student}
                      onViewJourney={() => navigate(getStudentPortfolioViewPath(student._id))}
                    />
                  ))
                )}
              </div>
            </div>

            {leaderboardQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  onClick={() => leaderboardQuery.fetchNextPage()}
                  disabled={leaderboardQuery.isFetchingNextPage}
                >
                  {leaderboardQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </div>

          {sidePanel ? <div>{sidePanel}</div> : null}
        </div>
      </div>

      <StudentJourneyDrawerBase
        open={Boolean(selectedStudentId)}
        journey={journeyQuery.data}
        onClose={() => navigate(`${basePath}/students`)}
      />
    </>
  );
}

function StudentRow({
  student,
  onViewJourney,
}: {
  student: StudentLeaderboardItem;
  onViewJourney: () => void;
}) {
  const rowAccent = student.rank <= 3 ? rankRowAccent[student.rank] : '';
  const stage = student.stage;
  const stageCls =
    stage && stagePillStyle[stage]
      ? stagePillStyle[stage]
      : 'bg-slate-800 text-slate-500 border-slate-700/50';
  const scorePercent = Math.min(
    (student.innovationScore / MAX_INNOVATION_SCORE) * 100,
    100,
  );

  return (
    <div
      className={`grid grid-cols-[56px,1fr,172px,96px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-900 ${rowAccent}`}
    >
      <div className="flex items-center justify-center">
        {student.rank <= 3 ? (
          <Medal className={`h-5 w-5 ${medalColorMap[student.rank]}`} />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-slate-500">
            {student.rank}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
          {student.avatar ? (
            <img
              src={student.avatar}
              alt={student.displayName}
              className="h-9 w-9 rounded-xl object-cover"
            />
          ) : (
            student.displayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{student.displayName}</div>
          <div className="mt-1 flex items-center gap-2">
            {stage ? (
              <span
                className={`rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${stageCls}`}
              >
                {stage}
              </span>
            ) : null}
            <span className="truncate text-xs text-slate-500">
              {student.activeProject?.title ?? 'No active workspace'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline gap-1">
          <span className="text-sm font-bold tabular-nums text-white">
            {student.innovationScore}
          </span>
          <span className="text-[10px] text-slate-600">/ {MAX_INNOVATION_SCORE}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onViewJourney}
          className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-300"
        >
          Journey
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
