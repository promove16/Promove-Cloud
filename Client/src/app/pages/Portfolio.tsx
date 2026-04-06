import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  Calendar,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Github,
  Globe,
  GraduationCap,
  Instagram,
  Linkedin,
  Link2,
  MapPin,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Twitter,
  Youtube,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { DashboardLayout } from "../components/DashboardLayout";
import { userApi } from "../../api/user.api";
import { scoreApi } from "../../api/score.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { studentApi } from "../../api/student.api";
import { useAuthStore } from "../../store/authStore";
import { useInnovationScore } from "../../hooks/useInnovationScore";
import { DEFAULT_STARTUP_IPR_PROFILE } from "../../features/startup/iprIntake";
import { UserRole } from "../../types/roles.types";

const eventLabel: Record<string, string> = {
  PROBLEM_CLAIMED: "Claimed a new problem",
  PROBLEM_COMPLETED: "Completed a problem",
  PROGRESS_UPLOADED: "Uploaded workspace progress",
  PATENT_SUBMITTED: "Patent filed",
  STARTUP_LAUNCHED: "Startup launched",
  GITHUB_CONNECTED: "Connected GitHub profile",
  LINKEDIN_CONNECTED: "Connected LinkedIn profile",
  RESUME_UPLOADED: "Uploaded resume",
  PROFILE_COMPLETE: "Completed profile",
};

const skillLevelColor: Record<string, string> = {
  beginner: "bg-slate-800 text-slate-300",
  intermediate: "bg-blue-500/15 text-blue-300",
  advanced: "bg-purple-500/15 text-purple-300",
  expert: "bg-amber-500/15 text-amber-300",
};

const experienceTypeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship",
  freelance: "Freelance",
  volunteer: "Volunteer",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function Portfolio() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [toast, setToast] = useState("");
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "experience" | "skills" | "timeline">("overview");

  const isStudent = authUser?.role === UserRole.STUDENT;

  const profileQuery = useQuery({
    queryKey: ["user-profile-me"],
    queryFn: () => userApi.getMe(),
  });
  const score = useInnovationScore();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
    enabled: isStudent,
  });
  const scoreHistory = useQuery({
    queryKey: ["score", "history", authUser?._id],
    queryFn: () => scoreApi.getScoreHistory(authUser!._id),
    enabled: isStudent && Boolean(authUser?._id),
  });
  const startups = useQuery({
    queryKey: ["startup", "mine"],
    queryFn: () => startupApi.mine(),
    enabled: isStudent,
  });

  const profile = profileQuery.data;

  const publicProfileUrl =
    authUser?.profileSlug && typeof window !== "undefined"
      ? `${window.location.origin}/students/${authUser.profileSlug}`
      : "";

  const canShareProfile = Boolean(
    authUser?.verificationStatus === "verified" &&
      authUser?.profileComplete &&
      authUser?.profileSlug,
  );

  const launchSourceWorkspace =
    (workspaces.data ?? []).length === 1 ? workspaces.data?.[0] : null;

  const innovationStats = useMemo(
    () => [
      { label: "Problems Solved", value: score.data?.breakdown.problemsClaimed ?? 0, icon: Target },
      { label: "Innovations", value: workspaces.data?.length ?? 0, icon: Rocket },
      { label: "Prototypes", value: score.data?.breakdown.progressUploads ?? 0, icon: Code2 },
      { label: "Patents Filed", value: score.data?.breakdown.patentsSubmitted ?? 0, icon: FileText },
      { label: "Startups", value: score.data?.breakdown.startupsLaunched ?? 0, icon: TrendingUp },
    ],
    [score.data, workspaces.data],
  );

  const skillsByCategory = useMemo(() => {
    const skills = profile?.skills ?? [];
    const categories: Record<string, typeof skills> = {};
    for (const skill of skills) {
      const cat = skill.category ?? "other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(skill);
    }
    return categories;
  }, [profile?.skills]);

  const categoryLabel: Record<string, string> = {
    programming: "Programming",
    design: "Design",
    business: "Business",
    research: "Research",
    other: "Other",
  };

  const launchToRecruiters = async () => {
    try {
      if ((startups.data?.length ?? 0) === 0) {
        await startupApi.create({
          projectId: launchSourceWorkspace?._id,
          name: launchSourceWorkspace?.title ?? "Student Innovation Profile",
          tagline: "Portfolio launch",
          category: launchSourceWorkspace?.category ?? "Innovation",
          stage: "Pre-Launch",
          activeProducts: 1,
          teamSize: launchSourceWorkspace?.teamMembers?.length ?? 1,
          traction: { patentFiled: false, mvpBuilt: false, revenueGenerating: false },
          businessProfile: {
            problemStatement: "",
            solutionSummary: "",
            targetCustomers: "",
            marketAnalysis: "",
            revenueModel: "",
            goToMarketPlan: "",
          },
          registrationProfile: { ...DEFAULT_STARTUP_IPR_PROFILE },
        });
      }
      const result = await studentApi.launchToRecruiters();
      setUser(result.user);
      setToast("Your portfolio is now visible to recruiters matching your skill set.");
      setShowLaunchModal(false);
      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      if (authUser?._id) {
        await queryClient.invalidateQueries({ queryKey: ["score", "history", authUser._id] });
      }
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Unable to launch your portfolio to recruiters.",
      );
    }
  };

  const copyShareLink = async () => {
    if (!publicProfileUrl) {
      setToast("Public portfolio link is not available yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setToast("Public portfolio link copied.");
    } catch {
      setToast("Unable to copy the public portfolio link.");
    }
  };

  const downloadPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(authUser?.displayName ?? "Portfolio", 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Innovation Score: ${score.data?.score ?? 0}`, 14, 30);
    pdf.text(`Role: ${authUser?.role ?? "student"}`, 14, 38);
    if (profile?.bio) {
      const bioLines = pdf.splitTextToSize(profile.bio, 180);
      pdf.text(bioLines, 14, 46);
    }
    pdf.text("Recent Timeline", 14, 58);
    (scoreHistory.data ?? []).slice(0, 8).forEach((event, index) => {
      pdf.text(
        `${index + 1}. ${eventLabel[event.trigger] ?? event.trigger} (+${event.delta})`,
        14,
        68 + index * 8,
      );
    });
    pdf.save("promove-portfolio.pdf");
  };

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "projects" as const, label: "Projects" },
    { id: "experience" as const, label: "Experience" },
    { id: "skills" as const, label: "Skills" },
    ...(isStudent ? [{ id: "timeline" as const, label: "Timeline" }] : []),
  ];

  return (
    <DashboardLayout role={authUser?.role ?? "student"}>
      <div className="space-y-8">
        {toast ? (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">
            {toast}
          </div>
        ) : null}

        {/* Hero Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: Avatar + Identity */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white overflow-hidden">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt={authUser?.displayName} className="w-24 h-24 object-cover" />
                ) : (
                  authUser?.displayName?.slice(0, 1).toUpperCase() ?? "U"
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-white">{authUser?.displayName ?? "My Portfolio"}</h1>
                  {authUser?.verificationStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>
                {profile?.headline ? (
                  <p className="text-slate-300 text-base mb-2">{profile.headline}</p>
                ) : null}
                {profile?.bio ? (
                  <p className="text-slate-400 text-sm max-w-2xl mb-3 leading-relaxed">{profile.bio}</p>
                ) : null}
                <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-4">
                  {profile?.domain ? (
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      {profile.domain}
                    </span>
                  ) : null}
                  {profile?.location ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-cyan-400" />
                      {profile.location}
                    </span>
                  ) : null}
                  {profile?.institutionProfile?.institutionName ? (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-cyan-400" />
                      {profile.institutionProfile.institutionName}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile?.linkedinUrl ? (
                    <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Linkedin className="h-3.5 w-3.5" />LinkedIn
                    </a>
                  ) : null}
                  {profile?.githubUrl ? (
                    <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Github className="h-3.5 w-3.5" />GitHub
                    </a>
                  ) : null}
                  {profile?.websiteUrl ? (
                    <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Globe className="h-3.5 w-3.5" />Website
                    </a>
                  ) : null}
                  {profile?.twitterUrl ? (
                    <a href={profile.twitterUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Twitter className="h-3.5 w-3.5" />Twitter
                    </a>
                  ) : null}
                  {profile?.youtubeUrl ? (
                    <a href={profile.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Youtube className="h-3.5 w-3.5" />YouTube
                    </a>
                  ) : null}
                  {profile?.instagramUrl ? (
                    <a href={profile.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Instagram className="h-3.5 w-3.5" />Instagram
                    </a>
                  ) : null}
                  {profile?.behanceUrl ? (
                    <a href={profile.behanceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Link2 className="h-3.5 w-3.5" />Behance
                    </a>
                  ) : null}
                  {profile?.dribbbleUrl ? (
                    <a href={profile.dribbbleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Link2 className="h-3.5 w-3.5" />Dribbble
                    </a>
                  ) : null}
                  {profile?.researchGateUrl ? (
                    <a href={profile.researchGateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Link2 className="h-3.5 w-3.5" />ResearchGate
                    </a>
                  ) : null}
                  {profile?.mediumUrl ? (
                    <a href={profile.mediumUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-200">
                      <Link2 className="h-3.5 w-3.5" />Medium
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right: Actions + Score */}
            <div className="flex flex-col gap-4">
              {isStudent && (
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => void copyShareLink()}
                    disabled={!canShareProfile}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button
                    onClick={() => setShowLaunchModal(true)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                  >
                    <Rocket className="w-4 h-4" />
                    Launch to Recruiters
                  </button>
                  <button
                    onClick={downloadPdf}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              )}

              {/* Innovation Score Display */}
              {isStudent && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-center min-w-[200px]">
                  <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Innovation Score</div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Award className="w-6 h-6 text-yellow-500" />
                    <span className="text-4xl font-bold text-white">{score.data?.score ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < Math.max(1, Math.round((score.data?.score ?? 0) / 50)) ? "text-yellow-500 fill-yellow-500" : "text-slate-700"}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isStudent && !canShareProfile ? (
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              Public sharing unlocks after your profile is complete and your institution has verified your account.
            </div>
          ) : null}
        </div>

        {/* Innovation Stats (student only) */}
        {isStudent ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {innovationStats.map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" ? (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* GitHub Stats */}
            {profile?.githubStats ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Github className="w-5 h-5 text-slate-300" />
                  <h2 className="text-lg font-bold text-white">GitHub Activity</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Repositories", value: profile.githubStats.totalRepos },
                    { label: "Total Stars", value: profile.githubStats.totalStars },
                    { label: "Total Forks", value: profile.githubStats.totalForks },
                    { label: "Contributions/yr", value: profile.githubStats.contributionsLastYear },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-950 rounded-lg p-4">
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="text-2xl font-bold text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
                {profile.githubStats.topLanguages.length > 0 ? (
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Top Languages</div>
                    <div className="space-y-2">
                      {profile.githubStats.topLanguages.slice(0, 5).map((lang) => (
                        <div key={lang.language}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{lang.language}</span>
                            <span className="text-slate-500">{lang.percentage}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                              style={{ width: `${lang.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 30-Day Proof (student) */}
            {isStudent && profile?.githubProof ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Code2 className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">30-Day Activity</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Commits", value: profile.githubProof.commitCount30Days },
                    { label: "Active Days", value: profile.githubProof.activeDays30Days },
                    { label: "Pull Requests", value: profile.githubProof.pullRequests30Days },
                    { label: "Issues", value: profile.githubProof.issues30Days },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-950 rounded-lg p-4">
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="text-2xl font-bold text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {(profile.githubProof.recentActivity ?? []).slice(0, 3).map((activity) => (
                    <div key={activity.id} className="bg-slate-950 rounded-lg p-3">
                      <div className="text-sm font-semibold text-white truncate">{activity.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{activity.repoFullName}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Education */}
            {(profile?.education ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">Education</h2>
                </div>
                <div className="space-y-4">
                  {(profile?.education ?? []).map((edu) => (
                    <div key={edu._id} className="border-l-2 border-blue-500/40 pl-4">
                      <div className="font-semibold text-white">{edu.degree} in {edu.fieldOfStudy}</div>
                      <div className="text-sm text-slate-300">{edu.institution}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {edu.startYear ? `${edu.startYear} – ` : ""}
                        {edu.isCurrent ? "Present" : edu.endYear ?? ""}
                        {edu.grade ? ` · ${edu.grade}` : ""}
                      </div>
                      {edu.description ? (
                        <div className="text-xs text-slate-400 mt-1">{edu.description}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Certifications */}
            {(profile?.certifications ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-bold text-white">Certifications</h2>
                </div>
                <div className="space-y-3">
                  {(profile?.certifications ?? []).map((cert) => (
                    <div key={cert._id} className="bg-slate-950 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{cert.name}</div>
                          <div className="text-sm text-slate-400">{cert.issuingOrganization}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {cert.issueDate ? `Issued ${formatDate(cert.issueDate)}` : ""}
                            {cert.expiryDate ? ` · Expires ${formatDate(cert.expiryDate)}` : ""}
                          </div>
                        </div>
                        {cert.credentialUrl ? (
                          <a
                            href={cert.credentialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-shrink-0 text-cyan-400 hover:text-cyan-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ProMove Workspaces (student only) */}
            {isStudent && (workspaces.data ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Rocket className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-white">Innovation Workspaces</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {(workspaces.data ?? []).map((ws) => (
                    <div key={ws._id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
                      <div className="font-bold text-white mb-1">{ws.title}</div>
                      <div className="text-sm text-slate-400 mb-3">{ws.category} · {ws.stage}</div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${ws.progressPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500">{ws.progressPercent}% complete</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Projects Tab */}
        {activeTab === "projects" ? (
          <div className="space-y-6">
            {/* Portfolio Projects */}
            {(profile?.portfolioProjects ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-5">Portfolio Projects</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {(profile?.portfolioProjects ?? []).map((project) => (
                    <div key={project._id} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-bold text-white">{project.title}</div>
                        {project.stars > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 flex-shrink-0">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {project.stars}
                          </span>
                        ) : null}
                      </div>
                      {project.description ? (
                        <p className="text-sm text-slate-400 mb-3">{project.description}</p>
                      ) : null}
                      {project.techStack.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {project.techStack.slice(0, 6).map((tech) => (
                            <span key={tech} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                              {tech}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {project.languages.length > 0 ? (
                        <div className="text-xs text-slate-500 mb-3">
                          {project.languages.slice(0, 4).join(" · ")}
                        </div>
                      ) : null}
                      <div className="flex gap-3 text-sm">
                        {project.repoUrl ? (
                          <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                            <Github className="w-3.5 h-3.5" />
                            Repository
                          </a>
                        ) : null}
                        {project.liveUrl ? (
                          <a href={project.liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Live Demo
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-400">
                No portfolio projects yet. Connect your GitHub or add projects manually in Settings.
              </div>
            )}

            {/* GitHub Imported Repos */}
            {isStudent && (profile?.githubProof?.importedRepos ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-5">GitHub Repositories</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {(profile?.githubProof?.importedRepos ?? []).map((repo) => (
                    <div key={repo.repoId} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="font-bold text-white">{repo.name}</div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {repo.stars}
                          </span>
                        </div>
                      </div>
                      {repo.description ? (
                        <p className="text-sm text-slate-400 mb-3">{repo.description}</p>
                      ) : null}
                      {repo.primaryLanguage ? (
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                          {repo.primaryLanguage}
                        </span>
                      ) : null}
                      <div className="mt-3">
                        <a href={repo.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300">
                          View on GitHub
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Experience Tab */}
        {activeTab === "experience" ? (
          <div className="space-y-6">
            {(profile?.experience ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white">Work Experience</h2>
                </div>
                <div className="space-y-6">
                  {(profile?.experience ?? []).map((exp, idx) => (
                    <div key={exp._id} className={`flex gap-5 ${idx < (profile?.experience?.length ?? 0) - 1 ? "pb-6 border-b border-slate-800" : ""}`}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white">{exp.title}</div>
                        <div className="text-sm text-slate-300 mb-1">{exp.company}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
                          <span className="bg-slate-800 px-2 py-0.5 rounded-full">
                            {experienceTypeLabel[exp.type] ?? exp.type}
                          </span>
                          {exp.location ? <span>{exp.location}</span> : null}
                          <span>
                            {formatDate(exp.startDate)} – {exp.isCurrent ? "Present" : formatDate(exp.endDate ?? undefined)}
                          </span>
                        </div>
                        {exp.description ? (
                          <p className="text-sm text-slate-400 leading-relaxed">{exp.description}</p>
                        ) : null}
                        {exp.skills.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {exp.skills.map((skill) => (
                              <span key={skill} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-400">
                No work experience added yet. Add experience in your profile settings.
              </div>
            )}

            {/* Education in experience tab */}
            {(profile?.education ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white">Education</h2>
                </div>
                <div className="space-y-6">
                  {(profile?.education ?? []).map((edu, idx) => (
                    <div key={edu._id} className={`flex gap-5 ${idx < (profile?.education?.length ?? 0) - 1 ? "pb-6 border-b border-slate-800" : ""}`}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">{edu.degree} in {edu.fieldOfStudy}</div>
                        <div className="text-sm text-slate-300 mb-1">{edu.institution}</div>
                        <div className="text-xs text-slate-500 mb-2">
                          {edu.startYear ? `${edu.startYear} – ` : ""}
                          {edu.isCurrent ? "Present" : edu.endYear ?? ""}
                          {edu.grade ? ` · Grade: ${edu.grade}` : ""}
                        </div>
                        {edu.description ? <p className="text-sm text-slate-400">{edu.description}</p> : null}
                        {edu.activities ? <p className="text-xs text-slate-500 mt-1">Activities: {edu.activities}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Certifications in experience tab */}
            {(profile?.certifications ?? []).length > 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-xl font-bold text-white">Certifications</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {(profile?.certifications ?? []).map((cert) => (
                    <div key={cert._id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white">{cert.name}</div>
                          <div className="text-sm text-slate-400 mt-0.5">{cert.issuingOrganization}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {cert.issueDate ? `Issued ${formatDate(cert.issueDate)}` : ""}
                            {cert.expiryDate ? ` · Expires ${formatDate(cert.expiryDate)}` : ""}
                          </div>
                          {cert.credentialId ? (
                            <div className="text-xs text-slate-600 mt-1">ID: {cert.credentialId}</div>
                          ) : null}
                        </div>
                        {cert.credentialUrl ? (
                          <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Skills Tab */}
        {activeTab === "skills" ? (
          <div className="space-y-6">
            {Object.keys(skillsByCategory).length > 0 ? (
              Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-lg font-bold text-white mb-4">{categoryLabel[category] ?? category}</h2>
                  <div className="flex flex-wrap gap-3">
                    {skills.map((skill) => (
                      <div
                        key={`${skill.name}-${skill.source}`}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${skillLevelColor[skill.level] ?? "bg-slate-800 text-slate-300"}`}
                      >
                        <span>{skill.name}</span>
                        <span className="ml-2 text-xs opacity-60 capitalize">{skill.level}</span>
                        {skill.endorsements > 0 ? (
                          <span className="ml-2 text-xs opacity-60">· {skill.endorsements} ✓</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-400">
                No skills added yet. Connect GitHub or LinkedIn to auto-import skills, or add them manually in settings.
              </div>
            )}
          </div>
        ) : null}

        {/* Timeline Tab (student only) */}
        {activeTab === "timeline" && isStudent ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Innovation Timeline</h2>
            </div>
            {(scoreHistory.data ?? []).length > 0 ? (
              <div className="space-y-5">
                {(scoreHistory.data ?? []).map((event) => (
                  <div key={event._id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/15 flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 pb-5 border-l border-slate-800 pl-5 -ml-5 ml-0">
                      <div className="text-xs text-slate-500 mb-1">
                        {new Date(event.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <div className="font-bold text-white mb-0.5">
                        {eventLabel[event.trigger] ?? event.trigger}
                      </div>
                      <div className="text-sm text-slate-400">
                        Score updated to {event.scoreAfter}
                        <span className="ml-1 text-emerald-400 font-semibold">+{event.delta}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-6">No timeline events yet. Start solving problems to build your timeline.</div>
            )}
          </div>
        ) : null}

        {/* Launch to Recruiters Modal */}
        {showLaunchModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-2xl font-bold text-white">Launch Portfolio to Recruiters</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Confirm to make your portfolio visible to recruiters who match your innovation score and activity history.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLaunchModal(false)}
                  className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void launchToRecruiters()}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white"
                >
                  Confirm Launch
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
