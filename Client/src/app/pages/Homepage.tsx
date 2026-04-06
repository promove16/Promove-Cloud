import { Link } from "react-router-dom";
import {
  Award,
  Building2,
  Globe,
  GraduationCap,
  Lightbulb,
  Rocket,
  TrendingUp,
  Users,
} from "lucide-react";
import { BusinessLogo } from "../../components/branding/BusinessLogo";

const pipelineSteps = [
  {
    icon: Lightbulb,
    title: "Identify Problems",
    desc: "Submit and discover real-world challenges",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Rocket,
    title: "Build Products",
    desc: "Develop solutions with mentorship",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Award,
    title: "File Patents",
    desc: "Protect your intellectual property",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: TrendingUp,
    title: "Launch Startups",
    desc: "Turn innovations into businesses",
    color: "from-green-500 to-emerald-500",
  },
];

const platformModules = [
  { title: "Problem Bank", desc: "Global problem repository", icon: Globe, link: "/problem-bank" },
  { title: "Startup School", desc: "Learn and build startups", icon: GraduationCap, link: "/student" },
  { title: "Instant Internship", desc: "Work on real projects", icon: Building2, link: "/product-workspace" },
  { title: "Innovation Marketplace", desc: "License and sell innovations", icon: TrendingUp, link: "/marketplace" },
  { title: "Product Workspace", desc: "Build and collaborate on your product", icon: Lightbulb, link: "/product-workspace" },
  { title: "Patent Support", desc: "File patents with ease", icon: Award, link: "/patent-support" },
  { title: "Startup Launch", desc: "Launch your startup", icon: Rocket, link: "/startup-launch" },
  { title: "Portfolio", desc: "Track your innovation journey", icon: Users, link: "/portfolio" },
];

const stats = [
  { value: "10K+", label: "Student Innovators" },
  { value: "500+", label: "Innovation Problems" },
  { value: "200+", label: "Patents Filed" },
  { value: "100+", label: "Startups Launched" },
];

const successStories = [
  {
    name: "Sarah Chen",
    innovation: "AgriSense IoT",
    achievement: "Patent Filed and $50K Funded",
    category: "Agriculture",
  },
  {
    name: "Rajesh Kumar",
    innovation: "EduBridge AI",
    achievement: "Patent Pending and Incubated",
    category: "Education",
  },
  {
    name: "Maria Santos",
    innovation: "HealthTrack",
    achievement: "Licensed to MedTech Corp",
    category: "Healthcare",
  },
];

export function Homepage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BusinessLogo
            to="/"
            imageWrapperClassName="h-10 w-10"
            titleClassName="text-xl text-white"
            subtitle="Craft Your Career"
            subtitleClassName="text-slate-400"
          />
          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <div className="mb-6 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
          Global infrastructure for student innovation
        </div>
        <h1 className="mb-6 text-6xl font-bold leading-tight text-white">
          Where Problems Become
          <br />
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Products
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
          The world&apos;s first operating system for student innovators. Transform real-world
          problems into products, patents, and startups.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/login"
            className="transform rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 font-semibold text-white transition-all hover:scale-105 hover:from-blue-700 hover:to-purple-700"
          >
            Join as Student
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-slate-700 bg-slate-800 px-8 py-4 font-semibold text-white transition-all hover:bg-slate-700"
          >
            Partner as Institution
          </Link>
          <Link
            to="/problem-bank"
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-4 font-semibold text-white transition-all hover:bg-slate-800"
          >
            Submit a Problem
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">Innovation Pipeline</h2>
          <p className="text-lg text-slate-400">Problem - Product - Patent - Startup</p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {pipelineSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700"
            >
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br ${step.color}`}
              >
                <step.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">{step.title}</h3>
              <p className="text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="mb-12 text-center text-4xl font-bold text-white">Platform Modules</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {platformModules.map((module) => (
            <Link
              key={module.title}
              to={module.link}
              className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-slate-700 hover:bg-slate-900"
            >
              <module.icon className="mb-4 h-10 w-10 text-blue-500 transition-transform group-hover:scale-110" />
              <h3 className="mb-2 text-lg font-bold text-white">{module.title}</h3>
              <p className="text-sm text-slate-400">{module.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-blue-800/30 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-12">
          <div className="grid gap-8 text-center md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-2 text-5xl font-bold text-white">{stat.value}</div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="mb-12 text-center text-4xl font-bold text-white">
          Innovation Success Stories
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {successStories.map((story) => (
            <div key={story.name} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
              <h3 className="mb-1 text-xl font-bold text-white">{story.name}</h3>
              <div className="mb-2 text-blue-400">{story.innovation}</div>
              <div className="mb-3 text-sm text-slate-400">{story.achievement}</div>
              <div className="inline-block rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {story.category}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-12">
          <h2 className="mb-4 text-4xl font-bold text-white">
            Ready to Start Your Innovation Journey?
          </h2>
          <p className="mb-8 text-lg text-blue-100">
            Solve Problems. Build Products. Own Innovation.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-xl bg-white px-8 py-4 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-4">
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
              <h4 className="mb-4 font-semibold text-white">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link to="/problem-bank" className="hover:text-white">
                    Problem Bank
                  </Link>
                </li>
                <li>
                  <Link to="/marketplace" className="hover:text-white">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link to="/startup-launch" className="hover:text-white">
                    Startup Launch
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">For Institutions</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Schools
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Colleges
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Mentors
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Investors
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            (c) 2026 ProMove Innovation Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
