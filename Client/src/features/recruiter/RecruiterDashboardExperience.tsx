import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recruiterApi } from "../../api/recruiter.api";
import { getStudentPortfolioViewPath } from "../marketplace/navigation";
import { RECRUITER_PAGE_CONTENT_CLASS } from "./RecruiterSectionNav";
import type {
  RecruiterHiringEventView,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import {
  Briefcase, Users, Search, TrendingUp, Eye, Plus,
  Building2, Target, CheckCircle, X, Bell
} from "lucide-react";

interface RecruiterDashboardExperienceProps {
  initialView?: string;
}

interface Project {
  id: number;
  title: string;
  problemStatement: string;
  domain: string;
  role: string;
  outcome: string;
  techStack: string[];
  mentor?: string;
  patentStatus: "Filed" | "Granted" | "None";
  timeline: string;
}

interface Student {
  id: string;
  name: string;
  photo: string;
  college: string;
  course: string;
  graduationYear: number;
  innovationScore: number;
  skills: string[];
  latestProject: string;
  domain: string;
  availability: "Internship" | "Full-time" | "Not listed";
  patentStatus: "Filed" | "Granted" | "None";
  cgpa: string;
  about?: string;
  projects?: Project[];
  canContact: boolean;
  bridgeType?: RecruiterTalentSummary["bridgeType"];
}

interface Drive {
  id: string;
  name: string;
  college: string;
  applications: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  status: "Active" | "Paused" | "Closed";
}

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ST";

const currentYear = new Date().getFullYear();

const daysSince = (value?: string) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
};

const relativeTime = (value?: string) => {
  const days = daysSince(value);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
};

const scoreToCgpa = (score?: number) => {
  if (typeof score !== "number") return "Not added";
  return `${Math.min(10, Math.max(0, score / 20)).toFixed(1)}`;
};

const patentStatusFromSummary = (student: RecruiterTalentSummary) => {
  if (student.scoreBreakdown.patentsApproved > 0) return "Granted" as const;
  if (student.scoreBreakdown.patentsSubmitted > 0) return "Filed" as const;
  return "None" as const;
};

const latestProjectFor = (student: RecruiterTalentSummary) =>
  student.activeProject?.title ?? "No active project yet";

const domainFor = (student: RecruiterTalentSummary) =>
  student.activeProject?.category ?? student.skills[0] ?? "General Innovation";

const mapTalentToStudent = (student: RecruiterTalentSummary): Student => ({
  id: student._id,
  name: student.displayName,
  photo: initialsFor(student.displayName),
  college: student.institution?.name ?? "Independent",
  course: student.activeProject?.category ?? student.skills[0] ?? "Profile not completed",
  graduationYear: currentYear,
  innovationScore: student.innovationScore,
  skills: student.skills.length ? student.skills : ["Innovation"],
  latestProject: latestProjectFor(student),
  domain: domainFor(student),
  availability: "Not listed",
  patentStatus: patentStatusFromSummary(student),
  cgpa: scoreToCgpa(student.innovationScore),
  about: student.activeProject
    ? `${student.activeProject.title} is currently in ${student.activeProject.stage}.`
    : undefined,
  canContact: student.canContact,
  ...(student.bridgeType ? { bridgeType: student.bridgeType } : {}),
  projects: student.activeProject
    ? [
        {
          id: 1,
          title: student.activeProject.title,
          problemStatement: "Problem statement not added yet.",
          domain: student.activeProject.category,
          role: "Project contributor",
          outcome: `${student.activeProject.progressPercent}% complete in ${student.activeProject.stage}.`,
          techStack: student.skills,
          patentStatus: "None",
          timeline: "Active workspace",
        },
      ]
    : [],
});

const mapEvent = (event: RecruiterHiringEventView): Drive => ({
  id: event._id,
  name: event.title,
  college: event.collegeName,
  applications: event.participantsCount,
  shortlisted: 0,
  interviewed: event.participants.filter((student) => typeof student.submissionScore === "number").length,
  offered: 0,
  status: event.isActive ? "Active" : "Closed",
});

const initialJobForm = {
  title: "",
  company: "",
  description: "",
  domain: "",
  type: "Full-time" as "Full-time" | "Internship" | "Contract" | "Part-time",
  location: "",
  workMode: "On-site" as "On-site" | "Hybrid" | "Remote",
  minimumInnovationScore: "0",
  openings: "1",
};

export function RecruiterDashboardExperience({ initialView = "home" }: RecruiterDashboardExperienceProps) {
  const navigate = useNavigate();
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [jobFormError, setJobFormError] = useState("");

  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ["recruiter", "dashboard"],
    queryFn: recruiterApi.getDashboard,
  });

  const jobsQuery = useQuery({
    queryKey: ["recruiter", "jobs"],
    queryFn: recruiterApi.getJobs,
  });

  const eventsQuery = useQuery({
    queryKey: ["recruiter", "hiring-events"],
    queryFn: recruiterApi.getHiringEvents,
  });

  const pipelineQuery = useQuery({
    queryKey: ["recruiter", "talent", "pipeline"],
    queryFn: () => recruiterApi.getTalentPipeline({ page: 1, limit: 12 }),
  });

  const createJobMutation = useMutation({
    mutationFn: recruiterApi.createJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] });
      setShowJobModal(false);
      setJobForm(initialJobForm);
      setJobFormError("");
    },
    onError: (error) => {
      setJobFormError(error instanceof Error ? error.message : "Could not create job posting.");
    },
  });

  const submitJob = () => {
    if (
      !jobForm.title.trim() ||
      !jobForm.company.trim() ||
      !jobForm.description.trim() ||
      !jobForm.domain.trim() ||
      !jobForm.location.trim()
    ) {
      setJobFormError("Title, company, domain, location and description are required.");
      return;
    }
    createJobMutation.mutate({
      title: jobForm.title.trim(),
      company: jobForm.company.trim(),
      description: jobForm.description.trim(),
      domain: jobForm.domain.trim(),
      type: jobForm.type,
      location: jobForm.location.trim(),
      workMode: jobForm.workMode,
      minimumInnovationScore: Number(jobForm.minimumInnovationScore) || 0,
      openings: Number(jobForm.openings) || 1,
    });
  };

  const baseTalent = dashboardQuery.data?.newMatches ?? [];

  const newMatches: Student[] = useMemo(() => {
    return baseTalent.map(mapTalentToStudent);
  }, [baseTalent]);

  const sourceEvents = eventsQuery.data ?? [];
  const activeEvents: Drive[] = useMemo(
    () => sourceEvents.map(mapEvent),
    [sourceEvents],
  );

  const recentActivity = useMemo(
    () =>
      (pipelineQuery.data?.items ?? []).map((student) => ({
        student: student.displayName,
        action: student.activeProject
          ? `updated ${student.activeProject.title}`
          : "entered your recruiter pipeline",
        time: relativeTime(student.createdAt),
      })),
    [pipelineQuery.data?.items],
  );

  const stats = {
    openPositions: dashboardQuery.data?.openPositions ?? 0,
    totalApplicants:
      (jobsQuery.data ?? []).reduce((sum, job) => sum + job.applicantCount, 0) +
      sourceEvents.reduce((sum, event) => sum + event.participantsCount, 0),
    shortlistedThisWeek: dashboardQuery.data?.shortlistedThisWeek ?? 0,
    newScoreMatchCandidates: dashboardQuery.data?.newScoreMatchCandidates ?? 0,
  };

  const renderHome = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          onClick={() => navigate('/dashboard/recruiter/applications')}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          <Users className="w-5 h-5" />
          Applications
        </button>
        <button
          onClick={() => setShowJobModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Post a Job
        </button>
        <button
          onClick={() => navigate('/dashboard/recruiter/marketplace?view=talent')}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          <Search className="w-5 h-5" />
          Search Talent
        </button>
        <button
          onClick={() => navigate('/dashboard/recruiter/campus')}
          className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-pink-500/20"
        >
          <Building2 className="w-5 h-5" />
          Start a Campus Drive
        </button>
        <button
          onClick={() => navigate('/dashboard/recruiter/onboarding')}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <CheckCircle className="w-5 h-5" />
          Onboarding Tracker
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-1">Total Applicants</div>
              <div className="text-xl font-bold text-white">{stats.totalApplicants}</div>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.openPositions}</div>
          <div className="text-sm font-semibold text-white">Open Positions</div>
          <div className="mt-3 text-xs text-slate-400">Across all active drives</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle className="w-7 h-7 text-white" />
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.shortlistedThisWeek}</div>
          <div className="text-sm font-semibold text-white mb-1">Shortlisted This Week</div>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span>{stats.newScoreMatchCandidates} new score matches</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div className="text-4xl font-bold text-white mb-2">{activeEvents.filter((event) => event.status === "Active").length}</div>
          <div className="text-sm font-semibold text-white mb-1">Active Campus Events</div>
          <div className="text-xs text-slate-400">Across {new Set(activeEvents.map(d => d.college)).size} institutions</div>
        </div>
      </div>

      {/* New Matches Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-500" />
            New Matches
            <span className="ml-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">
              {newMatches.length}
            </span>
          </h2>
          <span className="text-sm text-slate-400">Based on your saved criteria</span>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {newMatches.map((student) => (
            <div key={student.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold text-lg">{student.photo}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">{student.name}</h3>
                  <p className="text-sm text-slate-400 truncate">{student.college}</p>
                </div>
                <div className="px-3 py-1 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-sm font-bold text-white text-center">{student.innovationScore}</div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">Latest Project</div>
                <div className="text-sm font-semibold text-white truncate">{student.latestProject}</div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {student.skills.slice(0, 3).map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                    {skill}
                  </span>
                ))}
              </div>
              <button
                onClick={() => navigate(getStudentPortfolioViewPath(student.id))}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Portfolio
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Bell className="w-6 h-6 text-purple-500" />
          Recent Activity
        </h2>
        <div className="space-y-4">
          {recentActivity.map((activity, i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 -mx-2 px-2 py-2 rounded-lg transition-all">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-white">
                  <span className="font-semibold">{activity.student}</span>{" "}
                  <span className="text-slate-400">{activity.action}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-8`}>
      {/* Content */}
      {renderHome()}

      {/* Job Creation Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Post a Job</h2>
              <button
                onClick={() => {
                  setShowJobModal(false);
                  setJobFormError("");
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitJob();
              }}
            >
              {jobFormError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {jobFormError}
                </div>
              ) : null}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Job Title</label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
                    placeholder="Software Engineer"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Company</label>
                  <input
                    type="text"
                    value={jobForm.company}
                    onChange={(event) => setJobForm({ ...jobForm, company: event.target.value })}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Domain</label>
                  <input
                    type="text"
                    value={jobForm.domain}
                    onChange={(event) => setJobForm({ ...jobForm, domain: event.target.value })}
                    placeholder="AI / ML"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Location</label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })}
                    placeholder="Bangalore, India"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Type</label>
                  <select
                    value={jobForm.type}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        type: event.target.value as typeof jobForm.type,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Work Mode</label>
                  <select
                    value={jobForm.workMode}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        workMode: event.target.value as typeof jobForm.workMode,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Minimum Innovation Score</label>
                  <input
                    type="number"
                    value={jobForm.minimumInnovationScore}
                    onChange={(event) => setJobForm({ ...jobForm, minimumInnovationScore: event.target.value })}
                    placeholder="70"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Number of Openings</label>
                  <input
                    type="number"
                    value={jobForm.openings}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        openings: event.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Job Description</label>
                  <textarea
                    rows={5}
                    value={jobForm.description}
                    onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })}
                    placeholder="Describe the role, responsibilities, and qualifications..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={createJobMutation.isPending}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 disabled:opacity-60"
              >
                {createJobMutation.isPending ? "Posting..." : "Post Job"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecruiterDashboardHome() {
  return <RecruiterDashboardExperience initialView="home" />;
}

export default RecruiterDashboardHome;
