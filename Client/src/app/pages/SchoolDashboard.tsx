import { DashboardLayout } from "../components/DashboardLayout";
import { Users, TrendingUp, Award, Target, Trophy, Calendar, Bell, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function SchoolDashboard() {
  const { user } = useAuth();
  
  const stats = [
    { label: "Total Students", value: "248", icon: Users, color: "from-blue-500 to-cyan-500", change: "+12%" },
    { label: "Active Projects", value: "67", icon: Target, color: "from-purple-500 to-pink-500", change: "+8%" },
    { label: "Patents Filed", value: "18", icon: Award, color: "from-green-500 to-emerald-500", change: "+25%" },
    { label: "Startups Launched", value: "5", icon: TrendingUp, color: "from-yellow-500 to-orange-500", change: "+2" },
  ];

  const topInnovators = [
    { name: "Sarah Chen", projects: 5, patents: 2, score: 87, avatar: "SC", trend: "up" },
    { name: "Rajesh Kumar", projects: 4, patents: 1, score: 82, avatar: "RK", trend: "up" },
    { name: "Maria Santos", projects: 3, patents: 2, score: 79, avatar: "MS", trend: "same" },
    { name: "David Lee", projects: 4, patents: 1, score: 76, avatar: "DL", trend: "up" },
  ];

  const recentProjects = [
    { id: 1, name: "AgriSense IoT", student: "Sarah Chen", category: "Agriculture", status: "Patent Filed", progress: 90 },
    { id: 2, name: "EduBridge AI", student: "Rajesh Kumar", category: "Education", status: "Development", progress: 75 },
    { id: 3, name: "Smart Water Monitor", student: "Maria Santos", category: "Environment", status: "Ideation", progress: 40 },
    { id: 4, name: "HealthTrack Pro", student: "David Lee", category: "Healthcare", status: "Testing", progress: 65 },
  ];

  const upcomingEvents = [
    { title: "Innovation Showcase 2026", date: "March 15, 2026", type: "Competition" },
    { title: "Patent Workshop", date: "March 18, 2026", type: "Workshop" },
    { title: "Investor Demo Day", date: "March 25, 2026", type: "Event" },
  ];

  return (
    <DashboardLayout role="school">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user?.name || "School"}! 🏫</h1>
          <p className="text-slate-400">Monitor your student innovators and manage programs</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
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

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top Innovators */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Top Student Innovators</h2>
              <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold">
                View All →
              </button>
            </div>
            <div className="space-y-4">
              {topInnovators.map((student, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                      {student.avatar}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white mb-1">{student.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>{student.projects} Projects</span>
                        <span>{student.patents} Patents</span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          Score: {student.score}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      student.trend === "up" ? "bg-green-500/10 text-green-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      {student.trend === "up" ? "↑ Rising" : "→ Stable"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
              <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <Plus className="w-5 h-5 text-blue-500" />
              </button>
            </div>
            <div className="space-y-4">
              {upcomingEvents.map((event, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{event.title}</h3>
                      <p className="text-xs text-slate-400 mb-2">{event.date}</p>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{event.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Recent Projects</h2>
            <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold">
              View All Projects →
            </button>
          </div>
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div key={project.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{project.name}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">by {project.student}</span>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{project.category}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.status === "Patent Filed" ? "bg-green-500/10 text-green-400" :
                    project.status === "Development" ? "bg-blue-500/10 text-blue-400" :
                    project.status === "Testing" ? "bg-purple-500/10 text-purple-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {project.status}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-white font-semibold">{project.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-2">New Feature: Competition Management</h3>
              <p className="text-slate-400 mb-4">
                You can now create and manage innovation competitions directly through the platform. Engage your students with challenges and rewards!
              </p>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-white mb-2">92%</div>
            <div className="text-slate-400">Student Engagement Rate</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-white mb-2">156</div>
            <div className="text-slate-400">Total Innovations Created</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-white mb-2">$250K</div>
            <div className="text-slate-400">Funding Secured by Students</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}