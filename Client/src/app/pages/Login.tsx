import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket,
  User,
  Building2,
  Users,
  TrendingUp,
  Briefcase,
  Shield,
  Mail,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const roles = [
    { id: "student", name: "Student Innovator", icon: User, desc: "Build products, file patents, launch startups", path: "/dashboard" },
    { id: "school", name: "School", icon: Building2, desc: "Run innovation programs, track projects", path: "/dashboard" },
    { id: "college", name: "College", icon: Building2, desc: "Operate incubation programs, mentor students", path: "/dashboard" },
    { id: "mentor", name: "Mentor", icon: Users, desc: "Guide product development, review innovations", path: "/dashboard" },
    { id: "investor", name: "Investor", icon: TrendingUp, desc: "Discover startups, fund student companies", path: "/dashboard" },
    { id: "company", name: "Recruiter", icon: Briefcase, desc: "Source innovations, license technologies", path: "/dashboard" },
    { id: "admin", name: "Admin", icon: Shield, desc: "Manage platform, verify innovations", path: "/dashboard" },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedRole) {
      setError("Please select a role");
      return;
    }

    if (!formData.email || !formData.password) {
      setError("Please enter email and password");
      return;
    }

    const result = await login(formData.email, formData.password, selectedRole);
    if (result.success) {
      navigate(result.redirectTo ?? '/dashboard');
    } else {
      setError(result.error ?? "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-3 justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Rocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="font-bold text-2xl text-white">ProMove</div>
              <div className="text-xs text-slate-400">Innovation Cloud</div>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8">
          {/* Email and Password */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">
              Email Address
            </label>
            <div className="relative mb-4">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <label className="block text-sm font-semibold text-white mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-3">
              Select Your Role
            </label>
            <div className="grid md:grid-cols-3 gap-4">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    selectedRole === role.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-800 bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <role.icon className={`w-10 h-10 mb-4 ${selectedRole === role.id ? "text-blue-500" : "text-slate-400"}`} />
                  <h3 className="text-lg font-bold text-white mb-2">{role.name}</h3>
                  <p className="text-sm text-slate-400">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full px-12 py-4 rounded-xl font-semibold transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            Sign In
          </button>
        </form>

        <div className="text-center">
          <p className="text-slate-500 text-sm">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-500 hover:text-blue-400 font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
