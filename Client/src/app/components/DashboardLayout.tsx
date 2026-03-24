import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Rocket, Home, Globe, FileText, Trophy, 
  Award, TrendingUp, ShoppingCart, Building2, Settings, 
  LogOut, Menu, X, User, Bell, Calendar, Briefcase, Layers,
  Search, Users, Target
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "student" | "school" | "mentor" | "admin" | "investor" | "recruiter";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const studentMenu = [
    { icon: Home, label: "Dashboard", path: "/student" },
    { icon: Globe, label: "Problem Bank", path: "/problem-bank" },
    { icon: FileText, label: "Product Workspace", path: "/product-workspace" },
    { icon: Award, label: "Patent Support", path: "/patent-support" },
    { icon: TrendingUp, label: "Startup Launch", path: "/startup-launch" },
    { icon: Trophy, label: "Leadership Profile", path: "/leadership-profile" },
    { icon: ShoppingCart, label: "Marketplace", path: "/marketplace" },
  ];

  const schoolMenu = [
    { icon: Home, label: "Dashboard", path: "/school" },
    { icon: User, label: "Student Innovators", path: "/school" },
    { icon: Trophy, label: "Innovation Stats", path: "/school" },
    { icon: Globe, label: "Projects", path: "/school" },
    { icon: Award, label: "Competitions", path: "/school" },
  ];

  const investorMenu = [
    { icon: Home, label: "Deal Flow", path: "/investor" },
    { icon: TrendingUp, label: "Startups", path: "/investor" },
    { icon: Building2, label: "Institutions", path: "/investor" },
    { icon: Briefcase, label: "My Portfolio", path: "/investor" },
  ];

  const mentorMenu = [
    { icon: Home, label: "Dashboard", path: "/mentor" },
    { icon: Users, label: "Students", path: "/mentor" },
    { icon: Target, label: "Reviews", path: "/mentor" },
    { icon: Calendar, label: "Sessions", path: "/mentor" },
  ];

  const recruiterMenu = [
    { icon: Home, label: "Home", path: "/recruiter" },
    { icon: Search, label: "Talent Search", path: "/recruiter" },
    { icon: Building2, label: "College Connect", path: "/recruiter" },
    { icon: Target, label: "Active Drives", path: "/recruiter" },
    { icon: Users, label: "Onboarding Tracker", path: "/recruiter" },
  ];

  const adminMenu = [
    { icon: Home, label: "Dashboard", path: "/admin" },
    { icon: Globe, label: "Platform Analytics", path: "/admin" },
    { icon: FileText, label: "Innovations", path: "/admin" },
    { icon: Award, label: "Patents Pipeline", path: "/admin" },
    { icon: TrendingUp, label: "Startup Launches", path: "/admin" },
  ];

  const menu = role === "student" ? studentMenu : 
                role === "school" ? schoolMenu : 
                role === "mentor" ? mentorMenu :
                role === "investor" ? investorMenu : 
                role === "recruiter" ? recruiterMenu :
                adminMenu;

  const upcomingEvents = [
    { title: "Startup School Workshop", date: "Mar 15", time: "2:00 PM", type: "workshop" },
    { title: "Mentoring Session Batch A", date: "Mar 16", time: "10:00 AM", type: "mentoring" },
    { title: "National Hackathon Finals", date: "Mar 18", time: "9:00 AM", type: "competition" },
    { title: "Industry Connect Session", date: "Mar 20", time: "3:00 PM", type: "workshop" },
    { title: "Mentoring Session Batch B", date: "Mar 22", time: "11:00 AM", type: "mentoring" },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg text-white">ProMove</div>
                <div className="text-xs text-slate-400">Innovation Cloud</div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-slate-400" />
              {unreadCount > 0 ? (
                <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                  {Math.min(unreadCount, 99)}
                </div>
              ) : null}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-white">{user?.name || "User"}</div>
                <div className="text-xs text-slate-400 capitalize">{user?.role || role}</div>
              </div>
            </button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 
          transition-transform duration-300 z-40 overflow-y-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <div className="p-6 space-y-2 mt-16 lg:mt-0">
            {menu.map((item, i) => (
              <Link
                key={i}
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors group"
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
            
            {/* Calendar Widget for School Dashboard */}
            {role === "school" && (
              <div className="pt-4 mt-4 border-t border-slate-800">
                <div className="mb-3 flex items-center gap-2 px-4">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase">Upcoming Events</span>
                </div>
                <div className="space-y-2">
                  {upcomingEvents.map((event, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-lg border-l-2 ${
                        event.type === "workshop" ? "bg-blue-900/20 border-blue-500" :
                        event.type === "mentoring" ? "bg-green-900/20 border-green-500" :
                        "bg-orange-900/20 border-orange-500"
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-1 ${
                        event.type === "workshop" ? "text-blue-400" :
                        event.type === "mentoring" ? "text-green-400" :
                        "text-orange-400"
                      }`}>
                        {event.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {event.date} • {event.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t border-slate-800 mt-4">
              <Link
                to="/student"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}
