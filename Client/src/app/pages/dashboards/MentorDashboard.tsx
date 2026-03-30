import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Target, Award, Clock, MessageSquare, TrendingUp, CheckCircle2, AlertCircle, FileText, Shield, Loader2 } from "lucide-react";
import { mentorApi, MentorDashboardData, MentorFeedStudent } from "../../../api/mentor.api";

export function MentorDashboard() {
  const dashboardQuery = useQuery<MentorDashboardData>({
    queryKey: ['mentor-dashboard'],
    queryFn: () => mentorApi.getDashboard(),
  });

  const studentsQuery = useQuery<MentorFeedStudent[]>({
    queryKey: ['mentor-students'],
    queryFn: () => mentorApi.getStudents(),
  });

  const dashboard = dashboardQuery.data;
  const students = studentsQuery.data ?? [];
  const isLoading = dashboardQuery.isLoading || studentsQuery.isLoading;

  const stats = [
    { label: "Active Students", value: dashboard?.activeStudentCount?.toString() ?? "—", icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Pending Reviews", value: dashboard?.pendingReviews?.toString() ?? "—", icon: Target, color: "from-purple-500 to-pink-500" },
    { label: "Sessions Today", value: dashboard?.sessionsToday?.toString() ?? "—", icon: Clock, color: "from-green-500 to-emerald-500" },
    { label: "Students Watched", value: students.filter(s => s.isWatched).length.toString(), icon: AlertCircle, color: "from-yellow-500 to-orange-500" },
  ];

  // Extract patent activity from recent activities
  const patentActivities = (dashboard?.recentActivities ?? []).filter(
    a => a.trigger === 'PATENT_SUBMITTED' || a.trigger === 'PATENT_APPROVED'
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Mentor Dashboard 🎯</h1>
        <p className="text-slate-400">Guide your students through their innovation journey</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading dashboard data…</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Patent Activity Section */}
      <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-800/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-white">Student Patent Activity</h2>
        </div>
        {patentActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <FileText className="h-8 w-8 opacity-40 mb-2" />
            <div className="text-sm">No recent patent activity from your students.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {patentActivities.map((activity, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.trigger === 'PATENT_APPROVED' ? 'bg-green-500/10' : 'bg-yellow-500/10'
                }`}>
                  {activity.trigger === 'PATENT_APPROVED' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Award className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{activity.studentName}</p>
                  <p className="text-sm text-slate-400">
                    {activity.trigger === 'PATENT_APPROVED' ? 'Patent approved' : 'Submitted a patent'} · Score: {activity.newScore} ({activity.delta > 0 ? '+' : ''}{activity.delta})
                  </p>
                </div>
                <span className="text-xs text-slate-500">{new Date(activity.timestamp).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Your Students</h2>
        {students.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Users className="h-8 w-8 opacity-40 mb-2" />
            <div className="text-sm">No assigned students yet.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((student) => (
              <div
                key={student._id}
                className={`bg-slate-950 border rounded-xl p-6 hover:border-blue-500/50 transition-all group ${
                  student.isWatched ? "border-yellow-500/30" : "border-slate-800"
                }`}
              >
                <div className="flex items-start gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {student.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{student.displayName}</h3>
                        <span className="text-lg font-bold text-slate-400">#{student.innovationScore}</span>
                        {student.isWatched && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-semibold">Watched</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-3">
                        {student.startupName || student.category} · {student.recentActivitySummary}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Link
                          to={`/mentor/students/${student.studentId}`}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all text-center"
                        >
                          View Portfolio
                        </Link>
                        <button className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Leave Feedback
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Pending Feedback</h3>
          <p className="text-3xl font-bold text-white mb-1">{dashboard?.pendingReviews ?? '—'}</p>
          <p className="text-sm text-slate-400">Projects awaiting review</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Sessions Today</h3>
          <p className="text-3xl font-bold text-white mb-1">{dashboard?.sessionsToday ?? '—'}</p>
          <p className="text-sm text-slate-400">Scheduled for today</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Patent Submissions</h3>
          <p className="text-3xl font-bold text-white mb-1">{patentActivities.length}</p>
          <p className="text-sm text-slate-400">Recent student patents</p>
        </div>
      </div>
    </div>
  );
}
