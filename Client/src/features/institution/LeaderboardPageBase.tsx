import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal, Search, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';
import { StudentJourneyDrawerBase } from './StudentJourneyDrawerBase';
import { getScoreSocket } from '../../lib/socket';
import { LeaderboardPage, StudentJourney, StudentLeaderboardItem } from '../../types/school.types';
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
};

const medalColorMap: Record<number, string> = {
  1: 'text-amber-300',
  2: 'text-slate-300',
  3: 'text-orange-300',
};

export function LeaderboardPageBase({
  mode,
  title,
  subtitle,
  basePath,
  fetchPage,
  fetchJourney,
  headerAction,
  prelude,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ id?: string }>();
  const selectedStudentId = params.id;
  const [search, setSearch] = useState('');

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
    if (!socket.connected) {
      socket.connect();
    }

    const handleScoreUpdate = () => {
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

  const renderRank = (student: StudentLeaderboardItem) => {
    if (student.rank <= 3) {
      return (
        <div className="flex items-center gap-2 font-semibold text-white">
          <Medal className={`h-5 w-5 ${medalColorMap[student.rank]}`} />
          <span>{student.rank}</span>
        </div>
      );
    }

    return <span className="font-semibold text-white">{student.rank}</span>;
  };

  return (
    <>
      <div className="space-y-6">
        {prelude}

        <InstitutionWorkspaceHeader
          mode={mode}
          eyebrow="Ranked by Innovation Score"
          title={title}
          description={subtitle}
          headerAction={headerAction}
          tabsAction={
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student name"
                className="pl-11"
              />
            </div>
          }
        />

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[88px,1.6fr,180px,1.2fr,140px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
            <div>#</div>
            <div>Student</div>
            <div>Innovation Score</div>
            <div>Active Project</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-slate-800">
            {leaderboardQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student._id}
                  className="grid grid-cols-[88px,1.6fr,180px,1.2fr,140px] items-center gap-4 px-5 py-5"
                >
                  <div>{renderRank(student)}</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-lg font-bold text-white">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.displayName}
                          className="h-11 w-11 rounded-2xl object-cover"
                        />
                      ) : (
                        student.displayName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{student.displayName}</div>
                      <div className="text-sm text-slate-400">
                        Joined {new Date(student.activeSince).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-sm font-semibold text-cyan-200">
                        {student.innovationScore}
                      </div>
                      <span className="text-sm text-slate-400">/ {MAX_INNOVATION_SCORE}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                        style={{ width: `${Math.min((student.innovationScore / MAX_INNOVATION_SCORE) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {student.activeProject?.title ?? 'No active workspace'}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {student.stage ?? 'Waiting for activity'}
                    </div>
                  </div>
                  <div>
                    <Button onClick={() => navigate(getStudentPortfolioViewPath(student._id))}>
                      View Journey
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {leaderboardQuery.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => leaderboardQuery.fetchNextPage()}
              disabled={leaderboardQuery.isFetchingNextPage}
            >
              {leaderboardQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        ) : null}
      </div>

      <StudentJourneyDrawerBase
        open={Boolean(selectedStudentId)}
        journey={journeyQuery.data}
        onClose={() => navigate(`${basePath}/students`)}
      />
    </>
  );
}
