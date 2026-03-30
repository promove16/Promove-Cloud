import { useQuery } from "@tanstack/react-query";
import { 
  Users, Target, Award, TrendingUp, Download, Trophy, Handshake, 
  CheckCircle, AlertCircle, Clock, Star, Lightbulb, FileText, 
  MessageSquare, Building2, Shield, Loader2
} from "lucide-react";
import { schoolApi } from "../../../api/school.api";
import type { SchoolDashboardData } from "../../../types/school.types";

export function SchoolDashboard() {
  const dashboardQuery = useQuery<SchoolDashboardData>({
    queryKey: ['school-dashboard'],
    queryFn: () => schoolApi.getDashboard(),
  });

  const data = dashboardQuery.data;
  const s = data?.stats;

  const stats = [
    { label: "Total Students Enrolled", value: s?.totalStudents?.toString() ?? "—", icon: Users, color: "from-blue-500 to-cyan-500", trend: "" },
    { label: "Innovation Activities", value: s?.totalInnovationActivities?.toString() ?? "—", icon: Lightbulb, color: "from-purple-500 to-pink-500", trend: "" },
    { label: "Patents Filed", value: s?.patentsFiled?.toString() ?? "—", icon: Award, color: "from-yellow-500 to-orange-500", trend: data?.recentActivityCounts ? `+${data.recentActivityCounts.patentsLast30Days} this month` : "" },
    { label: "Mentoring Hours", value: s?.totalMentoringHours?.toString() ?? "—", icon: MessageSquare, color: "from-green-500 to-emerald-500", trend: "" },
    { label: "Startups Launched", value: s?.startupsLaunched?.toString() ?? "—", icon: TrendingUp, color: "from-pink-500 to-rose-500", trend: data?.recentActivityCounts ? `+${data.recentActivityCounts.startupsLast30Days} this month` : "" },
    { label: "Industry Collaborations", value: s?.industryCollaborations?.toString() ?? "—", icon: Handshake, color: "from-indigo-500 to-blue-500", trend: "" },
  ];

  const complianceFrameworks = [
    { 
      name: "IIC (Institution's Innovation Council)", 
      status: "On Track", 
      score: "4.2 Stars", 
      lastUpdated: "Mar 10, 2026",
      color: "green" 
    },
    { 
      name: "NAAC (Accreditation)", 
      status: "On Track", 
      score: "A+ Grade", 
      lastUpdated: "Feb 28, 2026",
      color: "green" 
    },
    { 
      name: "NIRF (Innovation Ranking)", 
      status: "In Progress", 
      score: "Band 51-100", 
      lastUpdated: "Mar 5, 2026",
      color: "yellow" 
    },
    { 
      name: "NEP 2020 Compliance", 
      status: "On Track", 
      score: "92%", 
      lastUpdated: "Mar 8, 2026",
      color: "green" 
    },
    { 
      name: "AICTE Regulations", 
      status: "Needs Attention", 
      score: "2 pending items", 
      lastUpdated: "Mar 1, 2026",
      color: "red" 
    },
    { 
      name: "NISP (National Innovation Startup Policy)", 
      status: "In Progress", 
      score: "78%", 
      lastUpdated: "Mar 7, 2026",
      color: "yellow" 
    },
  ];

  const iicActivities = [
    { name: "Workshops Conducted", count: 24, icon: Target },
    { name: "Student Ideas Submitted", count: 187, icon: Lightbulb },
    { name: "Patents Filed", count: 18, icon: Award },
    { name: "Mentoring Programs", count: 12, icon: MessageSquare },
    { name: "Industry Collaborations", count: 23, icon: Handshake },
  ];

  const leaderboard = [
    { rank: 1, name: "Sarah Chen", score: 94, projects: 5, patents: 2, stage: "Patent Filed", avatar: "SC", trend: "up" },
    { rank: 2, name: "Rajesh Kumar", score: 89, projects: 4, patents: 2, stage: "Product Build", avatar: "RK", trend: "up" },
    { rank: 3, name: "Maria Santos", score: 86, projects: 6, patents: 1, stage: "Startup Launch", avatar: "MS", trend: "same" },
    { rank: 4, name: "David Lee", score: 82, projects: 3, patents: 1, stage: "Idea Development", avatar: "DL", trend: "up" },
    { rank: 5, name: "Emma Wilson", score: 79, projects: 4, patents: 1, stage: "Patent Review", avatar: "EW", trend: "down" },
  ];

  const recentActivity = [
    { student: "Sarah Chen", action: "filed patent application", project: "AgriSense IoT", time: "2 hours ago", type: "patent" },
    { student: "Rajesh Kumar", action: "completed milestone", project: "EduBridge AI", time: "5 hours ago", type: "milestone" },
    { student: "Maria Santos", action: "launched startup", project: "HealthTrack Pro", time: "1 day ago", type: "startup" },
    { student: "David Lee", action: "started new project", project: "Smart Water Monitor", time: "1 day ago", type: "project" },
    { student: "Emma Wilson", action: "submitted patent draft", project: "GreenEnergy Hub", time: "2 days ago", type: "patent" },
  ];

  const currentIICStars = 4.2;
  const iicProgress = (currentIICStars / 5) * 100;

  const handleDownloadReport = () => {
    // In real app, this would generate and download a PDF
    console.log("Generating compliance report...");
    alert("Compliance Report PDF will be downloaded. This includes:\n• Innovation Metrics Summary\n• NAAC Documentation\n• NIRF Data Points\n• Patent & Startup Statistics\n• Student Performance Analytics");
  };

  return (
    <div className="space-y-8">
      {/* Header with Download Report */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Institution Command Centre 🏫</h1>
          <p className="text-slate-400">Real-time analytics and compliance dashboard</p>
        </div>
        <button 
          onClick={handleDownloadReport}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20"
        >
          <Download className="w-5 h-5" />
          Download Compliance Report
        </button>
      </div>

      {/* Enhanced Stat Cards */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
            <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-7 h-7 text-white" />
            </div>
            <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
            <div className="text-sm font-semibold text-white mb-1">{stat.label}</div>
            <div className="text-xs text-slate-400">{stat.trend}</div>
          </div>
        ))}
      </div>

      {/* Innovation Network Badge */}
      <div className="bg-gradient-to-r from-orange-900/30 via-slate-900 to-blue-900/30 border-2 border-orange-500/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-white">Institution Innovation Network</h3>
                <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-semibold">
                  VERIFIED
                </span>
              </div>
              <p className="text-slate-300 text-lg">
                Integrated with <span className="font-semibold text-blue-400">ProMove Innovation Cloud</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Verified institutional innovation partner</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-white">2026</div>
              <div className="text-sm text-slate-400">Active Since</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* IIC Score Estimator */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              IIC Star Rating Estimator
            </h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${
                    star <= Math.floor(currentIICStars)
                      ? "text-yellow-500 fill-yellow-500"
                      : star === Math.ceil(currentIICStars) && currentIICStars % 1 !== 0
                      ? "text-yellow-500 fill-yellow-500 opacity-50"
                      : "text-slate-600"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Current Estimated Rating</span>
              <span className="text-2xl font-bold text-white">{currentIICStars} / 5.0</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                style={{ width: `${iicProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Based on activities conducted in AY 2025-26</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Contributing Activities</h3>
            {iicActivities.map((activity, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <activity.icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-300">{activity.name}</span>
                </div>
                <span className="text-lg font-bold text-white">{activity.count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
            <p className="text-xs text-blue-300">
              <strong>Note:</strong> To achieve 5-star rating, focus on increasing student ideas submission and industry partnerships.
            </p>
          </div>
        </div>

        {/* Policy Compliance Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              Policy Compliance Panel
            </h2>
            <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-semibold">
              {complianceFrameworks.filter(f => f.status === "On Track").length}/6 On Track
            </span>
          </div>

          <div className="space-y-3">
            {complianceFrameworks.map((framework, i) => (
              <div
                key={i}
                className={`bg-slate-950 border rounded-xl p-5 transition-all ${
                  framework.color === "green" ? "border-green-500/30 hover:border-green-500/50" :
                  framework.color === "yellow" ? "border-yellow-500/30 hover:border-yellow-500/50" :
                  "border-red-500/30 hover:border-red-500/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{framework.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      Updated {framework.lastUpdated}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    framework.color === "green" ? "bg-green-500/10 text-green-400" :
                    framework.color === "yellow" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {framework.color === "green" ? <CheckCircle className="w-3 h-3" /> :
                     framework.color === "yellow" ? <Clock className="w-3 h-3" /> :
                     <AlertCircle className="w-3 h-3" />}
                    {framework.status}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <span className="text-xs text-slate-500">Score / Level</span>
                  <span className={`text-sm font-bold ${
                    framework.color === "green" ? "text-green-400" :
                    framework.color === "yellow" ? "text-yellow-400" :
                    "text-red-400"
                  }`}>
                    {framework.score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">
                <strong>Action Required:</strong> AICTE compliance has 2 pending items. Review and submit documentation by March 15, 2026.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Student Leaderboard */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Top Innovators
            </h2>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">
              This Month
            </span>
          </div>
          <div className="space-y-3">
            {leaderboard.map((student) => (
              <div key={student.rank} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-blue-500/50 transition-all group">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    student.rank === 1 ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white" :
                    student.rank === 2 ? "bg-gradient-to-br from-slate-400 to-slate-500 text-white" :
                    student.rank === 3 ? "bg-gradient-to-br from-orange-600 to-orange-700 text-white" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {student.rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{student.avatar}</span>
                  </div>

                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white mb-1">{student.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{student.projects} projects</span>
                      <span>•</span>
                      <span>{student.patents} patents</span>
                      <span>•</span>
                      <span className="truncate">{student.stage}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{student.score}</div>
                    <div className="text-xs text-slate-400">Score</div>
                  </div>

                  {/* Trend */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    student.trend === "up" ? "bg-green-500/10" :
                    student.trend === "down" ? "bg-red-500/10" :
                    "bg-slate-800"
                  }`}>
                    <TrendingUp className={`w-4 h-4 ${
                      student.trend === "up" ? "text-green-500" :
                      student.trend === "down" ? "text-red-500 rotate-180" :
                      "text-slate-500"
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-800 last:border-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activity.type === "patent" ? "bg-yellow-500/10" :
                  activity.type === "startup" ? "bg-green-500/10" :
                  activity.type === "milestone" ? "bg-blue-500/10" :
                  "bg-purple-500/10"
                }`}>
                  {activity.type === "patent" ? <Award className="w-5 h-5 text-yellow-500" /> :
                   activity.type === "startup" ? <TrendingUp className="w-5 h-5 text-green-500" /> :
                   activity.type === "milestone" ? <Target className="w-5 h-5 text-blue-500" /> :
                   <Users className="w-5 h-5 text-purple-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white mb-1">
                    <span className="font-semibold">{activity.student}</span>{" "}
                    <span className="text-slate-400">{activity.action}</span>
                  </p>
                  <p className="text-sm text-blue-400 mb-1 truncate">{activity.project}</p>
                  <p className="text-xs text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
