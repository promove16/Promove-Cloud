import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, CalendarDays, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mentorApi, MentorDashboardActivity } from '../../api/mentor.api';
import { getMentorSocket } from '../../lib/socket';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

export default function MentorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    queryKey: ['mentor-dashboard'],
    queryFn: mentorApi.getDashboard,
    refetchInterval: 60_000,
  });
  const [liveActivities, setLiveActivities] = useState<MentorDashboardActivity[]>([]);

  useEffect(() => {
    if (dashboardQuery.data) {
      setLiveActivities(dashboardQuery.data.recentActivities);
    }
  }, [dashboardQuery.data]);

  useEffect(() => {
    const socket = getMentorSocket();
    if (!socket.connected) {
      socket.connect();
    }
    const handleActivity = (activity: MentorDashboardActivity) => {
      setLiveActivities((current) => [activity, ...current.filter((item) => item.studentId !== activity.studentId)].slice(0, 10));
      void queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
    };

    socket.on('student:activity', handleActivity);
    return () => {
      socket.off('student:activity', handleActivity);
    };
  }, [queryClient]);

  const stats = useMemo(
    () => [
      { label: 'Students in Feed', value: dashboardQuery.data?.activeStudentCount ?? 0, icon: Users },
      { label: 'Sessions Today', value: dashboardQuery.data?.sessionsToday ?? 0, icon: CalendarDays },
      { label: 'Pending Reviews', value: dashboardQuery.data?.pendingReviews ?? 0, icon: Activity },
    ],
    [dashboardQuery.data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Workspace</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Welcome back, Mentor</h1>
          <p className="mt-2 text-slate-400">Watch student activity streams and keep sessions moving.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/mentor/students')}>
          Open Student Feed
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Live Feed</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Recent student activity</h2>
          </div>
          <Badge>{liveActivities.length} items</Badge>
        </div>

        {dashboardQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : liveActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center text-slate-400">
            No recent activity. Students will appear here when they launch to mentors.
          </div>
        ) : (
          <div className="space-y-3">
            {liveActivities.map((activity) => (
              <div key={`${activity.studentId}-${activity.timestamp}`} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
                  {activity.avatar ? (
                    <img src={activity.avatar} alt={activity.studentName} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    activity.studentName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{activity.studentName}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {activity.trigger} {activity.delta > 0 ? `(+${activity.delta} pts)` : ''}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(activity.timestamp).toLocaleString('en-IN')}</div>
                </div>
                <Button variant="secondary" onClick={() => navigate(`/dashboard/mentor/students/${activity.studentId}`)}>
                  View Student
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Patent Activity Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-yellow-300">Patent Activity</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Student patent submissions</h2>
          </div>
        </div>

        {(() => {
          const patentActivities = liveActivities.filter(
            (a) => a.trigger === 'PATENT_SUBMITTED' || a.trigger === 'PATENT_APPROVED'
          );
          if (patentActivities.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center text-slate-400">
                No recent patent activity from your students.
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {patentActivities.map((activity) => (
                <div
                  key={`patent-${activity.studentId}-${activity.timestamp}`}
                  className="flex items-start gap-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-sm font-bold text-white">
                    {activity.studentName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{activity.studentName}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {activity.trigger === 'PATENT_APPROVED' ? 'Patent approved' : 'Submitted a patent'}
                      {activity.delta > 0 ? ` (+${activity.delta} pts)` : ''}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(activity.timestamp).toLocaleString('en-IN')}</div>
                  </div>
                  <Badge>{activity.trigger === 'PATENT_APPROVED' ? 'Approved' : 'Submitted'}</Badge>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
