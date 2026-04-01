import { Link } from "react-router-dom";
import { Lightbulb, Rocket, Award, Globe, TrendingUp, Users, Building2, GraduationCap } from "lucide-react";
import { BusinessLogo } from "../../components/branding/BusinessLogo";

export function Homepage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <BusinessLogo
            to="/"
            imageWrapperClassName="h-10 w-10"
            titleClassName="text-xl text-white"
            subtitle="Craft Your Career"
            subtitleClassName="text-slate-400"
          />
          <Link
            to="/login"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-block px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-6">
          🌍 The Global Infrastructure for Student Innovation
        </div>
        <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
          Where Problems Become
          <br />
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Products
          </span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          The world's first operating system for student innovators. Transform real-world problems into products, patents, and startups.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            to="/login"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
          >
            Join as Student
          </Link>
          <Link
            to="/login"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold border border-slate-700 transition-all"
          >
            Partner as Institution
          </Link>
          <Link
            to="/problem-bank"
            className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white rounded-xl font-semibold border border-slate-700 transition-all"
          >
            Submit a Problem
          </Link>
        </div>
      </section>

      {/* Innovation Pipeline */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Innovation Pipeline</h2>
          <p className="text-slate-400 text-lg">Problem → Product → Patent → Startup</p>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { icon: Lightbulb, title: "Identify Problems", desc: "Submit and discover real-world challenges", color: "from-yellow-500 to-orange-500" },
            { icon: Rocket, title: "Build Products", desc: "Develop solutions with mentorship", color: "from-blue-500 to-cyan-500" },
            { icon: Award, title: "File Patents", desc: "Protect your intellectual property", color: "from-purple-500 to-pink-500" },
            { icon: TrendingUp, title: "Launch Startups", desc: "Turn innovations into businesses", color: "from-green-500 to-emerald-500" },
          ].map((step, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
              <div className={`w-14 h-14 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center mb-4`}>
                <step.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
              <p className="text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Modules */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white mb-12 text-center">Platform Modules</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Problem Bank", desc: "Global problem repository", icon: Globe, link: "/problem-bank" },
            { title: "Startup School", desc: "Learn and build startups", icon: GraduationCap, link: "/student" },
            { title: "Instant Internship", desc: "Work on real projects", icon: Building2, link: "/product-workspace" },
            { title: "Innovation Marketplace", desc: "License and sell innovations", icon: TrendingUp, link: "/marketplace" },
            { title: "Product Workspace", desc: "Build and collaborate on your product", icon: Lightbulb, link: "/product-workspace" },
            { title: "Patent Support", desc: "File patents with ease", icon: Award, link: "/patent-support" },
            { title: "Startup Launch", desc: "Launch your startup", icon: Rocket, link: "/startup-launch" },
            { title: "Leadership Profile", desc: "Track your innovation journey", icon: Users, link: "/leadership-profile" },
          ].map((module, i) => (
            <Link
              key={i}
              to={module.link}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:bg-slate-900 hover:border-slate-700 transition-all group"
            >
              <module.icon className="w-10 h-10 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white mb-2">{module.title}</h3>
              <p className="text-slate-400 text-sm">{module.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-2xl p-12">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10K+", label: "Student Innovators" },
              { value: "500+", label: "Innovation Problems" },
              { value: "200+", label: "Patents Filed" },
              { value: "100+", label: "Startups Launched" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white mb-12 text-center">Innovation Success Stories</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Sarah Chen", innovation: "AgriSense IoT", achievement: "Patent Filed & $50K Funded", category: "Agriculture" },
            { name: "Rajesh Kumar", innovation: "EduBridge AI", achievement: "Patent Pending & Incubated", category: "Education" },
            { name: "Maria Santos", innovation: "HealthTrack", achievement: "Licensed to MedTech Corp", category: "Healthcare" },
          ].map((story, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4"></div>
              <h3 className="text-xl font-bold text-white mb-1">{story.name}</h3>
              <div className="text-blue-400 mb-2">{story.innovation}</div>
              <div className="text-sm text-slate-400 mb-3">{story.achievement}</div>
              <div className="inline-block px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                {story.category}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Your Innovation Journey?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Solve Problems. Build Products. Own Innovation.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <BusinessLogo
                to="/"
                className="mb-4"
                imageWrapperClassName="h-8 w-8"
                titleClassName="text-lg text-white"
                subtitle="Craft Your Career"
                subtitleClassName="text-slate-400"
              />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link to="/problem-bank" className="hover:text-white">Problem Bank</Link></li>
                <li><Link to="/marketplace" className="hover:text-white">Marketplace</Link></li>
                <li><Link to="/startup-launch" className="hover:text-white">Startup Launch</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Institutions</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white">Schools</a></li>
                <li><a href="#" className="hover:text-white">Colleges</a></li>
                <li><a href="#" className="hover:text-white">Mentors</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Investors</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400 text-sm">
            © 2026 ProMove Innovation Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
