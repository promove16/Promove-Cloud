import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  Building2,
  Download,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Instagram,
  Linkedin,
  Link2,
  MapPin,
  Pencil,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Twitter,
  Youtube,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { type ProfileSkill, userApi } from "../../api/user.api";
import { scoreApi } from "../../api/score.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { studentApi } from "../../api/student.api";
import { useAuthStore } from "../../store/authStore";
import { useInnovationScore } from "../../hooks/useInnovationScore";
import { DEFAULT_STARTUP_IPR_PROFILE } from "../../features/startup/iprIntake";
import { getStartupOverviewPath } from "../../features/startup/navigation";
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

const experienceTypeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship",
  freelance: "Freelance",
  volunteer: "Volunteer",
};

const categoryLabel: Record<string, string> = {
  programming: "Programming",
  design: "Design",
  business: "Business",
  research: "Research",
  other: "Other",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
      {children}
    </div>
  );
}

function LogoTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-cyan-500/10 text-cyan-200">
      {children}
    </div>
  );
}

function ProfileButton({
  children,
  primary,
  onClick,
  disabled,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-full border border-cyan-400/70 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

export function Portfolio() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [toast, setToast] = useState("");
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const isStudent = authUser?.role === UserRole.STUDENT;

  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: () => userApi.getMe() });
  const score = useInnovationScore();
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list(), enabled: isStudent });
  const scoreHistory = useQuery({
    queryKey: ["score", "history", authUser?._id],
    queryFn: () => scoreApi.getScoreHistory(authUser!._id),
    enabled: isStudent && Boolean(authUser?._id),
  });
  const startups = useQuery({ queryKey: ["startup", "mine"], queryFn: () => startupApi.mine(), enabled: isStudent });

  const profile = profileQuery.data;
  const isOwner = Boolean(authUser?._id && profile?._id && authUser._id === profile._id);
  const canManagePortfolio = isStudent && isOwner;
  const displayName = profile?.displayName ?? authUser?.displayName ?? "Portfolio";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const publicProfileUrl = profile?.profileSlug && typeof window !== "undefined" ? `${window.location.origin}/students/${profile.profileSlug}` : "";
  const canShareProfile = Boolean(profile?.verificationStatus === "verified" && profile?.profileComplete && profile?.profileSlug);
  const launchSourceWorkspace = (workspaces.data ?? []).length === 1 ? workspaces.data?.[0] : null;
  const heroBackgroundStyle = profile?.avatarWallpaper
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.44)), url(${profile.avatarWallpaper})`,
      }
    : undefined;

  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (!githubStatus) return;
    setToast(githubStatus === "connected" ? "GitHub connected. Your proof signals will update shortly." : searchParams.get("message") ?? "GitHub connection failed.");
    void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    const next = new URLSearchParams(searchParams);
    next.delete("github");
    next.delete("message");
    setSearchParams(next, { replace: true });
  }, [queryClient, searchParams, setSearchParams]);

  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, ProfileSkill[]> = {};
    for (const skill of profile?.skills ?? []) {
      const category = skill.category ?? "other";
      grouped[category] = [...(grouped[category] ?? []), skill];
    }
    return grouped;
  }, [profile?.skills]);

  const socialLinks = [
    { label: "LinkedIn", url: profile?.linkedinUrl, icon: Linkedin },
    { label: "GitHub", url: profile?.githubUrl, icon: Github },
    { label: "Website", url: profile?.websiteUrl, icon: Globe },
    { label: "Twitter", url: profile?.twitterUrl, icon: Twitter },
    { label: "YouTube", url: profile?.youtubeUrl, icon: Youtube },
    { label: "Instagram", url: profile?.instagramUrl, icon: Instagram },
    { label: "Behance", url: profile?.behanceUrl, icon: Link2 },
    { label: "Dribbble", url: profile?.dribbbleUrl, icon: Link2 },
    { label: "ResearchGate", url: profile?.researchGateUrl, icon: Link2 },
    { label: "Medium", url: profile?.mediumUrl, icon: Link2 },
  ];
  const visibleSocialLinks = socialLinks.filter((link) => Boolean(link.url));
  const publicRepos = (profile?.githubProof?.importedRepos ?? []).filter((repo) => !repo.isPrivate).slice(0, 3);
  const recentActivity = (profile?.githubProof?.recentActivity ?? []).filter((activity) => !activity.isPrivate).slice(0, 4);
  const recentWorkspaces = useMemo(
    () => [...(workspaces.data ?? [])].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 3),
    [workspaces.data],
  );
  const recentStartups = useMemo(
    () => [...(startups.data ?? [])].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 3),
    [startups.data],
  );
  const featuredItems = [
    ...(profile?.portfolioProjects ?? []).slice(0, 3).map((item) => ({ kind: "Project", title: item.title, body: item.description, url: item.liveUrl ?? item.repoUrl, key: `project-${item._id}` })),
    ...(profile?.certifications ?? []).slice(0, 2).map((item) => ({ kind: "Certification", title: item.name, body: item.issuingOrganization, url: item.credentialUrl, key: `cert-${item._id}` })),
    ...(profile?.education ?? []).slice(0, 1).map((item) => ({ kind: "Education", title: item.institution, body: `${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, url: null, key: `edu-${item._id}` })),
  ];
  const profileStats = [
    { label: "Innovation Score", value: score.data?.score ?? profile?.innovationScore ?? 0 },
    { label: "Projects", value: profile?.portfolioProjects?.length ?? 0 },
    { label: "Skills", value: profile?.skills?.length ?? 0 },
    { label: "Certifications", value: profile?.certifications?.length ?? 0 },
  ];

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
          businessProfile: { problemStatement: "", solutionSummary: "", targetCustomers: "", marketAnalysis: "", revenueModel: "", goToMarketPlan: "" },
          registrationProfile: { ...DEFAULT_STARTUP_IPR_PROFILE },
        });
      }
      const result = await studentApi.launchToRecruiters();
      setUser(result.user);
      setToast("Your portfolio is now visible to recruiters matching your skill set.");
      setShowLaunchModal(false);
      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    } catch (error) {
      setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to launch your portfolio to recruiters.");
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
    pdf.text(displayName, 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Innovation Score: ${score.data?.score ?? profile?.innovationScore ?? 0}`, 14, 30);
    if (profile?.bio) pdf.text(pdf.splitTextToSize(profile.bio, 180), 14, 42);
    pdf.save("promove-portfolio.pdf");
  };

  return (
    <DashboardLayout role={authUser?.role ?? "student"}>
      <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-5 text-slate-100 lg:-mx-8 lg:px-8">
        <div className="w-full space-y-4">
          {toast ? <div className="rounded-lg border border-cyan-400/30 bg-slate-950 p-3 text-sm font-medium text-cyan-100">{toast}</div> : null}

          <section className="w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90 shadow-sm">
                <div
                  className={
                    profile?.avatarWallpaper
                      ? "relative h-48 bg-cover bg-center"
                      : "relative h-48 bg-[linear-gradient(135deg,_#243a8f_0%,_#0a66c2_46%,_#0b5cab_64%,_#f5b841_65%,_#f59e0b_78%,_#0a66c2_79%,_#0f4c81_100%)]"
                  }
                  style={heroBackgroundStyle}
                >
                  {!profile?.avatarWallpaper ? (
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,_transparent_0%,_transparent_42%,_rgba(255,255,255,0.24)_43%,_rgba(255,255,255,0.24)_50%,_transparent_51%)]" />
                  ) : null}
                  {canManagePortfolio ? (
                    <Link
                      to="/dashboard/profile"
                      className="absolute right-4 top-4 rounded-full bg-slate-950/90 p-2 text-cyan-200 shadow transition hover:bg-slate-800"
                      aria-label="Edit intro"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>

                <div className="px-6 pb-6">
                  <div className="-mt-20 flex items-end justify-between gap-4">
                    <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-slate-900 bg-slate-800 text-5xl font-semibold text-cyan-200 shadow-sm">
                      {profile?.avatar ? <img src={profile.avatar} alt={displayName} className="h-full w-full object-cover" /> : initials}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold leading-tight text-white">{displayName}</h1>
                        {profile?.verificationStatus === "verified" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f9e5] px-2.5 py-1 text-xs font-semibold text-[#057642]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-base text-slate-200">{profile?.headline || profile?.domain || "Innovation profile"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                        {profile?.domain ? <span>{profile.domain}</span> : null}
                        {profile?.location ? (
                          <>
                            <span aria-hidden="true">.</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>
                          </>
                        ) : null}
                        {profile?.institutionProfile?.institutionName ? (
                          <>
                            <span aria-hidden="true">.</span>
                            <span>{profile.institutionProfile.institutionName}</span>
                          </>
                        ) : null}
                      </div>
                      {visibleSocialLinks.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold text-cyan-200">
                          {visibleSocialLinks.slice(0, 6).map((link) => {
                            const Icon = link.icon;
                            return (
                              <a key={link.label} href={link.url ?? ""} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                <Icon className="h-3.5 w-3.5" />
                                {link.label}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canManagePortfolio ? (
                          <>
                            <Link
                              to="/dashboard/profile"
                              className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit profile
                            </Link>
                            <ProfileButton onClick={() => void copyShareLink()} disabled={!canShareProfile}>
                              <Share2 className="h-4 w-4" />
                              Share
                            </ProfileButton>
                            <ProfileButton onClick={() => setShowLaunchModal(true)}>
                              <Rocket className="h-4 w-4" />
                              Launch
                            </ProfileButton>
                            <ProfileButton onClick={downloadPdf}>
                              <Download className="h-4 w-4" />
                              PDF
                            </ProfileButton>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-[220px] space-y-3 text-sm">
                      {profile?.institutionProfile?.institutionName ? (
                        <div className="flex items-center gap-2 font-semibold text-slate-200">
                          <Building2 className="h-5 w-5 text-slate-400" />
                          {profile.institutionProfile.institutionName}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 font-semibold text-slate-200">
                        <Sparkles className="h-5 w-5 text-slate-400" />
                        Innovation Score {score.data?.score ?? profile?.innovationScore ?? 0}
                      </div>
                    </div>
                  </div>

                  {canManagePortfolio && !canShareProfile ? (
                    <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                      Public sharing unlocks after your profile is complete and your institution has verified your account.
                    </div>
                  ) : null}
                </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-3">
              <Section title="About">
                {profile?.bio ? <p className="whitespace-pre-line text-sm leading-6 text-slate-200">{profile.bio}</p> : <Empty>No about summary has been added yet.</Empty>}
              </Section>

              <Section title="Featured">
                {featuredItems.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {featuredItems.map((item) => (
                      <article key={item.key} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
                        <div className="flex h-24 items-center justify-center bg-cyan-500/10 text-cyan-200">
                          {item.kind === "Project" ? <Rocket className="h-8 w-8" /> : item.kind === "Certification" ? <Award className="h-8 w-8" /> : <GraduationCap className="h-8 w-8" />}
                        </div>
                        <div className="p-3">
                          <div className="text-xs text-slate-400">{item.kind}</div>
                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</h3>
                          {item.body ? <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.body}</p> : null}
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:underline">
                              View
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty>Featured work will appear here when projects, education, or certifications are available.</Empty>
                )}
              </Section>

              <Section title="Experience">
                {(profile?.experience ?? []).length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {(profile?.experience ?? []).map((exp) => (
                      <article key={exp._id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <LogoTile><Briefcase className="h-5 w-5" /></LogoTile>
                        <div className="min-w-0">
                          <h3 className="font-semibold">{exp.title}</h3>
                          <div className="text-sm text-slate-200">{exp.company}</div>
                          <div className="mt-0.5 text-sm text-slate-400">
                            {formatDate(exp.startDate)} - {exp.isCurrent ? "Present" : formatDate(exp.endDate ?? undefined)}
                            {exp.location ? ` . ${exp.location}` : ""} . {experienceTypeLabel[exp.type] ?? exp.type}
                          </div>
                          {exp.description ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{exp.description}</p> : null}
                          {exp.skills.length > 0 ? <div className="mt-2 text-sm font-semibold text-slate-300">{exp.skills.slice(0, 6).join(" . ")}</div> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <Empty>No experience has been added yet.</Empty>}
              </Section>

              <Section title="Education">
                {(profile?.education ?? []).length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {(profile?.education ?? []).map((edu) => (
                      <article key={edu._id} className={`flex gap-3 py-4 first:pt-0 last:pb-0 ${edu.source === "institution" ? "rounded-lg bg-cyan-500/5 px-3" : ""}`}>
                        <LogoTile><GraduationCap className="h-5 w-5" /></LogoTile>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{edu.institution}</h3>
                            {edu.source === "institution" ? (
                              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                                Current session
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm text-slate-200">{[edu.degree, edu.fieldOfStudy].filter(Boolean).join(", ")}</div>
                          <div className="mt-0.5 text-sm text-slate-400">{edu.startYear ? `${edu.startYear} - ` : ""}{edu.isCurrent ? "Present" : edu.endYear ?? ""}{edu.grade ? ` . Grade: ${edu.grade}` : ""}</div>
                          {edu.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{edu.description}</p> : null}
                          {edu.activities ? <p className="mt-1 text-sm text-slate-400">{edu.activities}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <Empty>No education entries have been added yet.</Empty>}
              </Section>

              <Section title="Licenses & certifications">
                {(profile?.certifications ?? []).length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {(profile?.certifications ?? []).map((cert) => (
                      <article key={cert._id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <LogoTile><Award className="h-5 w-5" /></LogoTile>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{cert.name}</h3>
                              <div className="text-sm text-slate-200">{cert.issuingOrganization}</div>
                              <div className="mt-0.5 text-sm text-slate-400">
                                {cert.issueDate ? `Issued ${formatDate(cert.issueDate)}` : ""}
                                {cert.expiryDate ? ` . Expires ${formatDate(cert.expiryDate)}` : ""}
                              </div>
                              {cert.credentialId ? <div className="mt-1 text-xs text-slate-500">Credential ID {cert.credentialId}</div> : null}
                            </div>
                            {cert.credentialUrl ? <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="text-cyan-200 hover:underline"><ExternalLink className="h-4 w-4" /></a> : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <Empty>No licenses or certifications have been added yet.</Empty>}
              </Section>

              <Section title="Skills">
                {Object.keys(skillsByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(skillsByCategory).map(([category, skills]) => (
                      <div key={category}>
                        <h3 className="font-semibold">{categoryLabel[category] ?? category}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {skills.map((skill) => (
                            <span key={`${skill.name}-${skill.source}`} className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty>No skills have been added yet.</Empty>}
              </Section>

              <Section title="Projects">
                {(profile?.portfolioProjects ?? []).length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {(profile?.portfolioProjects ?? []).map((project) => (
                      <article key={project._id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <LogoTile><Rocket className="h-5 w-5" /></LogoTile>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{project.title}</h3>
                              {project.description ? <p className="mt-1 text-sm leading-6 text-slate-300">{project.description}</p> : null}
                            </div>
                            {project.stars > 0 ? <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-amber-300"><Star className="h-3.5 w-3.5 fill-current" />{project.stars}</span> : null}
                          </div>
                          {project.techStack.length > 0 ? <div className="mt-2 text-sm font-semibold text-slate-300">{project.techStack.slice(0, 8).join(" . ")}</div> : null}
                          <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-cyan-200">
                            {project.repoUrl ? <a href={project.repoUrl} target="_blank" rel="noreferrer" className="hover:underline">Repository</a> : null}
                            {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noreferrer" className="hover:underline">Live demo</a> : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <Empty>No portfolio projects are available yet.</Empty>}
              </Section>

              <Section title="Startups">
                {recentStartups.length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {recentStartups.map((startup) => (
                      <article key={startup._id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <LogoTile><Building2 className="h-5 w-5" /></LogoTile>
                        <div className="min-w-0 flex-1">
                          <Link to={getStartupOverviewPath(startup._id)} className="font-semibold text-white hover:text-cyan-200 hover:underline">
                            {startup.name || "Untitled Startup"}
                          </Link>
                          {startup.tagline ? <p className="mt-1 text-sm leading-6 text-slate-300">{startup.tagline}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                            {startup.category ? <span>{startup.category}</span> : null}
                            <span>{startup.stage}</span>
                            <span>{startup.teamSize} member{startup.teamSize === 1 ? "" : "s"}</span>
                            <span className="capitalize">{startup.reviewStatus.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <Empty>No startups are linked to this profile yet.</Empty>}
              </Section>
            </main>

            <aside className="space-y-3">
              <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                <h2 className="font-semibold">Profile strength</h2>
                <div className="mt-4 space-y-3">
                  {profileStats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="font-semibold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                <h2 className="font-semibold">Activity</h2>
                {recentActivity.length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-800">
                    {recentActivity.map((activity) => (
                      <article key={activity.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <LogoTile><Github className="h-5 w-5" /></LogoTile>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white">{activity.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-300">{activity.summary}</p>
                            <div className="mt-1 text-xs text-slate-500">
                              {[activity.repoFullName, formatDateTime(activity.occurredAt)].filter(Boolean).join(" . ")}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (scoreHistory.data ?? []).length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-800">
                    {(scoreHistory.data ?? []).slice(0, 5).map((event) => (
                      <article key={event._id} className="py-4 first:pt-0 last:pb-0">
                        <h3 className="font-semibold text-white">{eventLabel[event.trigger] ?? event.trigger}</h3>
                        <p className="mt-1 text-sm text-slate-400">Innovation score updated to {event.scoreAfter} (+{event.delta}).</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Empty>No recent public activity is available yet.</Empty>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                <h2 className="font-semibold">Public profile & URL</h2>
                <p className="mt-2 break-all text-sm text-slate-400">{publicProfileUrl || "Public portfolio link is not available yet."}</p>
                <button type="button" onClick={() => void copyShareLink()} disabled={!publicProfileUrl} className="mt-3 text-sm font-semibold text-cyan-200 disabled:text-slate-600">
                  Copy public link
                </button>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                <h2 className="font-semibold">GitHub signal</h2>
                {profile?.githubStats ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Repositories</span><span className="font-semibold text-white">{profile.githubStats.totalRepos}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Stars</span><span className="font-semibold text-white">{profile.githubStats.totalStars}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Forks</span><span className="font-semibold text-white">{profile.githubStats.totalForks}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Contributions/yr</span><span className="font-semibold text-white">{profile.githubStats.contributionsLastYear}</span></div>
                    {profile.githubStats.topLanguages.length > 0 ? <p className="pt-2 text-xs text-slate-500">{profile.githubStats.topLanguages.slice(0, 5).map((lang) => `${lang.language} ${lang.percentage}%`).join(" . ")}</p> : null}
                  </div>
                ) : <div className="mt-3 text-sm text-slate-400">No GitHub signal is available yet.</div>}
              </section>

              {publicRepos.length > 0 ? (
                <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                  <h2 className="font-semibold">Repositories</h2>
                  <div className="mt-3 space-y-3">
                    {publicRepos.map((repo) => (
                      <a key={repo.repoId} href={repo.url} target="_blank" rel="noreferrer" className="block rounded-lg p-2 transition hover:bg-slate-800">
                        <div className="text-sm font-semibold text-cyan-200">{repo.fullName}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-400">{repo.description || "No description added."}</div>
                        <div className="mt-2 text-xs text-slate-500">{[repo.primaryLanguage, `${repo.stars} stars`].filter(Boolean).join(" . ")}</div>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              {canManagePortfolio && recentWorkspaces.length > 0 ? (
                <section className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-100 shadow-sm">
                  <h2 className="font-semibold">Innovation workspaces</h2>
                  <div className="mt-3 space-y-3">
                    {recentWorkspaces.map((ws) => (
                      <div key={ws._id}>
                        <div className="text-sm font-semibold">{ws.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{ws.category} . {ws.stage}</div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${ws.progressPercent}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        </div>

        {showLaunchModal && canManagePortfolio ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
            <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
              <h2 className="text-2xl font-semibold text-white">Launch Portfolio to Recruiters</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">Confirm to make your portfolio visible to recruiters who match your innovation score and activity history.</p>
              <div className="mt-6 flex justify-end gap-3">
                <ProfileButton onClick={() => setShowLaunchModal(false)}>Cancel</ProfileButton>
                <ProfileButton primary onClick={() => void launchToRecruiters()}>Confirm Launch</ProfileButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
