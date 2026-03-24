import { Link } from "react-router-dom";
import { Users, Target, Award, Clock, MessageSquare, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

export function MentorDashboard() {
  const assignedStudents = [
    {
      id: 1,
      name: "Sarah Chen",
      avatar: "SC",
      score: 94,
      projects: 5,
      currentStage: "Product Build",
      currentProject: "AgriSense IoT",
      progress: 85,
      lastActivity: "2 hours ago",
      status: "active",
      nextSession: "March 15, 2:00 PM",
      needsAttention: false,
    },
    {
      id: 2,
      name: "Rajesh Kumar",
      avatar: "RK",
      score: 89,
      projects: 4,
      currentStage: "Patent Review",
      currentProject: "EduBridge AI",
      progress: 75,
      lastActivity: "5 hours ago",
      status: "active",
      nextSession: "March 16, 10:00 AM",
      needsAttention: false,
    },
    {
      id: 3,
      name: "Maria Santos",
      avatar: "MS",
      score: 86,
      projects: 6,
      currentStage: "Startup Launch",
      currentProject: "HealthTrack Pro",
      progress: 90,
      lastActivity: "1 day ago",
      status: "active",
      nextSession: "March 17, 3:00 PM",
      needsAttention: false,
    },
    {
      id: 4,
      name: "David Lee",
      avatar: "DL",
      score: 82,
      projects: 3,
      currentStage: "Idea Development",
      currentProject: "Smart Water Monitor",
      progress: 40,
      lastActivity: "3 days ago",
      status: "attention",
      nextSession: "Not scheduled",
      needsAttention: true,
    },
    {
      id: 5,
      name: "Emma Wilson",
      avatar: "EW",
      score: 79,
      projects: 4,
      currentStage: "Patent Filing",
      currentProject: "GreenEnergy Hub",
      progress: 80,
      lastActivity: "6 hours ago",
      status: "active",
      nextSession: "March 18, 11:00 AM",
      needsAttention: true,
    },
    {
      id: 6,
      name: "Alex Johnson",
      avatar: "AJ",
      score: 76,
      projects: 2,
      currentStage: "Problem Solving",
      currentProject: "Urban Mobility AI",
      progress: 45,
      lastActivity: "12 hours ago",
      status: "active",
      nextSession: "March 19, 2:30 PM",
      needsAttention: false,
    },
  ];

  const stats = [
    { label: "Total Students", value: assignedStudents.length.toString(), icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Active Projects", value: "23", icon: Target, color: "from-purple-500 to-pink-500" },
    { label: "Avg Score", value: "84.3", icon: TrendingUp, color: "from-green-500 to-emerald-500" },
    { label: "Needs Attention", value: assignedStudents.filter(s => s.needsAttention).length.toString(), icon: AlertCircle, color: "from-yellow-500 to-orange-500" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Mentor Dashboard 🎯</h1>
        <p className="text-slate-400">Guide your students through their innovation journey</p>
      </div>

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

      {/* Students Needing Attention */}
      {assignedStudents.some(s => s.needsAttention) && (
        <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-bold text-white">Students Needing Attention</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {assignedStudents.filter(s => s.needsAttention).map((student) => (
              <div key={student.id} className="bg-slate-900 border border-yellow-500/30 rounded-xl p-5">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">{student.avatar}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white">{student.name}</h3>
                    <p className="text-sm text-slate-400">{student.currentProject}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold text-sm transition-all">
                    Schedule Session
                  </button>
                  <button className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all">
                    Send Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Students */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Your Students</h2>
        <div className="space-y-4">
          {assignedStudents.map((student) => (
            <div
              key={student.id}
              className={`bg-slate-950 border rounded-xl p-6 hover:border-blue-500/50 transition-all group ${
                student.needsAttention ? "border-yellow-500/30" : "border-slate-800"
              }`}
            >
              <div className="flex items-start gap-6">
                {/* Avatar & Basic Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">{student.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{student.name}</h3>
                      <span className="text-lg font-bold text-slate-400">#{student.score}</span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                      {student.projects} projects • Last active {student.lastActivity}
                    </p>

                    {/* Current Project */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Current Project</p>
                          <p className="font-semibold text-white">{student.currentProject}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          student.currentStage === "Startup Launch" 
                            ? "bg-green-500/10 text-green-400"
                            : student.currentStage === "Patent Review" || student.currentStage === "Patent Filing"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : student.currentStage === "Product Build"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {student.currentStage}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>Progress</span>
                          <span>{student.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Next Session */}
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                      <Clock className="w-4 h-4" />
                      <span>Next session: {student.nextSession}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Link
                        to={`/leadership-profile`}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all text-center"
                      >
                        View Portfolio
                      </Link>
                      <button className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Leave Feedback
                      </button>
                      <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all">
                        Message
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Pending Feedback</h3>
          <p className="text-3xl font-bold text-white mb-1">5</p>
          <p className="text-sm text-slate-400">Projects awaiting review</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Upcoming Sessions</h3>
          <p className="text-3xl font-bold text-white mb-1">8</p>
          <p className="text-sm text-slate-400">This week</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-700/30 rounded-xl p-6">
          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Completed Milestones</h3>
          <p className="text-3xl font-bold text-white mb-1">12</p>
          <p className="text-sm text-slate-400">This month</p>
        </div>
      </div>
    </div>
  );
}
