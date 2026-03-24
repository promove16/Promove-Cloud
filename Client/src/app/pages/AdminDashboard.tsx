import { DashboardLayout } from "../components/DashboardLayout";
import { Users, Globe, FileText, Award, TrendingUp, Activity, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AdminDashboard() {
  const { user } = useAuth();
  
  const platformStats = [
    { label: "Total Users", value: "12,456", icon: Users, color: "from-blue-500 to-cyan-500", change: "+8.2%" },
    { label: "Active Innovations", value: "487", icon: Globe, color: "from-purple-500 to-pink-500", change: "+12.5%" },
    { label: "Patents Pipeline", value: "234", icon: Award, color: "from-green-500 to-emerald-500", change: "+15.3%" },
    { label: "Startups Launched", value: "156", icon: TrendingUp, color: "from-yellow-500 to-orange-500", change: "+22.1%" },
  ];

  const recentActivities = [
    { type: "patent", user: "Sarah Chen", action: "filed patent application", item: "AgriSense IoT", time: "2 hours ago", status: "pending" },
    { type: "startup", user: "Rajesh Kumar", action: "launched startup", item: "EduBridge AI", time: "5 hours ago", status: "completed" },
    { type: "innovation", user: "Maria Santos", action: "submitted innovation", item: "HealthTrack Pro", time: "1 day ago", status: "verified" },
    { type: "problem", user: "David Lee", action: "added problem", item: "Urban Waste Management", time: "2 days ago", status: "verified" },
  ];

  const pendingApprovals = [
    { id: 1, type: "Patent Application", title: "Smart Irrigation System", submitter: "Sarah Chen", date: "March 8, 2026", priority: "high" },
    { id: 2, type: "Innovation Protection", title: "AI Learning Assistant", submitter: "John Doe", date: "March 9, 2026", priority: "medium" },
    { id: 3, type: "Startup Registration", title: "GreenTech Solutions", submitter: "Jane Smith", date: "March 9, 2026", priority: "high" },
  ];

  const schoolStats = [
    { name: "Stanford University", students: 248, projects: 67, patents: 18, startups: 5 },
    { name: "MIT", students: 312, projects: 89, patents: 24, startups: 8 },
    { name: "Harvard", students: 186, projects: 52, patents: 15, startups: 4 },
    { name: "UC Berkeley", students: 204, projects: 61, patents: 12, startups: 6 },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Platform analytics and management</p>
        </div>

        {/* Platform Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          {platformStats.map((stat, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-end justify-between mb-2">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm font-semibold text-green-400">{stat.change}</div>
              </div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Pending Approvals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-yellow-500" />
              Pending Approvals
            </h2>
            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-semibold">
              {pendingApprovals.length} pending
            </span>
          </div>
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{item.type}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.priority === "high" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {item.priority} priority
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                    <div className="text-sm text-slate-400">
                      Submitted by {item.submitter} • {item.date}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Approve
                  </button>
                  <button className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Review
                  </button>
                  <button className="flex-1 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 text-sm font-semibold rounded-lg transition-colors border border-red-800/30">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-500" />
              Recent Platform Activities
            </h2>
            <div className="space-y-4">
              {recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-800 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activity.status === "completed" ? "bg-green-500/10" :
                    activity.status === "verified" ? "bg-blue-500/10" :
                    "bg-yellow-500/10"
                  }`}>
                    {activity.status === "completed" || activity.status === "verified" ? (
                      <CheckCircle className={`w-5 h-5 ${
                        activity.status === "completed" ? "text-green-500" : "text-blue-500"
                      }`} />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white mb-1">
                      <span className="font-semibold">{activity.user}</span>{" "}
                      <span className="text-slate-400">{activity.action}</span>{" "}
                      <span className="text-blue-400">{activity.item}</span>
                    </p>
                    <div className="text-xs text-slate-500">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Schools */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Institution Statistics</h2>
            <div className="space-y-4">
              {schoolStats.map((school, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
                  <h3 className="font-bold text-white mb-3">{school.name}</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">{school.students}</div>
                      <div className="text-xs text-slate-400">Students</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">{school.projects}</div>
                      <div className="text-xs text-slate-400">Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">{school.patents}</div>
                      <div className="text-xs text-slate-400">Patents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">{school.startups}</div>
                      <div className="text-xs text-slate-400">Startups</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">99.9%</div>
                <div className="text-sm text-slate-400">Platform Uptime</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">1,234</div>
                <div className="text-sm text-slate-400">Active Users Today</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">+18%</div>
                <div className="text-sm text-slate-400">Growth This Month</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}