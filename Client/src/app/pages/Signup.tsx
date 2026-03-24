import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket,
  User,
  Building2,
  Users,
  TrendingUp,
  Briefcase,
  Mail,
  Lock,
  UserCircle,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
    institution: "",
  });
  const [error, setError] = useState("");

  const roles = [
    { id: "student", name: "Student Innovator", icon: User, desc: "Build products, file patents, launch startups" },
    { id: "school", name: "School", icon: Building2, desc: "Run innovation programs, track projects" },
    { id: "college", name: "College", icon: Building2, desc: "Operate incubation programs, mentor students" },
    { id: "mentor", name: "Mentor", icon: Users, desc: "Guide product development, review innovations" },
    { id: "investor", name: "Investor", icon: TrendingUp, desc: "Discover startups, fund student companies" },
    { id: "company", name: "Recruiter", icon: Briefcase, desc: "Source innovations, license technologies" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      setError("Please fill in all required fields");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    // Create account
    const result = await signup({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      role: formData.role,
    });
    
    if (result.success) {
      navigate(result.redirectTo ?? "/dashboard");
    } else {
      setError(result.error ?? "Failed to create account. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Rocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="font-bold text-2xl text-white">ProMove</div>
              <div className="text-xs text-slate-400">Innovation Cloud</div>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Create Your Account</h1>
          <p className="text-slate-400">Join the global innovation ecosystem</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {/* Personal Information */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Personal Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Sarah Chen"
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sarah@university.edu"
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Institution */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">
              Institution / Organization (Optional)
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="Stanford University"
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Password <span className="text-red-400">*</span>
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
                    minLength={8}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Password must be at least 8 characters long</p>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-3">
              Select Your Role <span className="text-red-400">*</span>
            </label>
            <div className="grid md:grid-cols-3 gap-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.id })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.role === role.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  <role.icon className={`w-8 h-8 mb-2 ${formData.role === role.id ? "text-blue-500" : "text-slate-400"}`} />
                  <h3 className="font-bold text-white text-sm mb-1">{role.name}</h3>
                  <p className="text-xs text-slate-400">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400">
                I agree to the{" "}
                <a href="#" className="text-blue-500 hover:text-blue-400">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-500 hover:text-blue-400">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all text-lg"
          >
            Create Account
          </button>

          {/* Login Link */}
          <p className="text-slate-400 text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-500 hover:text-blue-400 font-semibold">
              Sign in
            </Link>
          </p>
        </form>

        {/* Benefits */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {[
            { title: "Innovation Protection", desc: "Get certificates for your ideas" },
            { title: "Global Network", desc: "Connect with mentors and investors" },
            { title: "Free Resources", desc: "Access tools and support" },
          ].map((benefit, i) => (
            <div key={i} className="text-center">
              <div className="text-blue-400 font-semibold mb-1">{benefit.title}</div>
              <div className="text-slate-500 text-sm">{benefit.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
