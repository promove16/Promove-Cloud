import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  ExternalLink,
  Github,
  Linkedin,
  Link2,
  MapPin,
  MessageCircle,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { userApi } from "../../api/user.api";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { useAuthStore } from "../../store/authStore";
import { getMarketplaceBasePath } from "../marketplace/navigation";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function StudentPortfolioViewContent({ userId: userIdOverride }: { userId?: string } = {}) {
  const params = useParams<{ userId?: string; entityType?: string; entityId?: string }>();
  const userId =
    userIdOverride ??
    params.userId ??
    (params.entityType === "student" ? params.entityId ?? "" : "");
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const marketplacePath = getMarketplaceBasePath(authUser?.role);
  const profileQuery = useQuery({
    queryKey: ["student-portfolio-view", userId],
    queryFn: () => userApi.getStudentPortfolioView(userId),
    enabled: userId.trim().length > 0,
  });

  const profile = profileQuery.data;
  const visibleSocialLinks = useMemo(
    () =>
      [
        { label: "LinkedIn", url: profile?.linkedinUrl, icon: Linkedin },
        { label: "GitHub", url: profile?.githubUrl, icon: Github },
        { label: "Website", url: profile?.websiteUrl, icon: Link2 },
      ].filter((item): item is { label: string; url: string; icon: typeof Linkedin } => Boolean(item.url)),
    [profile],
  );

  const previousEntries = useMemo(() => {
    if (!profile) return [];
    return profile.experience.slice(0, 3).map((e) => ({
      company: e.company,
      role: e.title,
    }));
  }, [profile]);

  const handleMessage = () => {
    if (!profile?._id) return;
    const storageKey = `dm_first_contact_${profile._id}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${profile._id}`);
  };

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-6 text-slate-100 lg:-mx-8 lg:px-8">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={marketplacePath}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          {profile ? (
            <button
              type="button"
              onClick={handleMessage}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </button>
          ) : null}
        </div>

        {profileQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Loading student portfolio...
          </div>
        ) : null}

        {!profileQuery.isLoading && (profileQuery.isError || !profile) ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            This student portfolio is not available for your role or could not be loaded.
          </div>
        ) : null}

        {profile ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            {/* ── Left area: Hero + Content ── */}
            <div className="space-y-4">
              {/* Hero */}
              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_24px_60px_rgba(3,7,18,0.4)]">
                <div className="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6">
                  <div className="relative group/avatar mx-auto sm:mx-0 shrink-0">
                    {/* Ambient Glow */}
                    <div className="absolute -inset-1.5 rounded-[2rem] bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 opacity-30 blur-md transition duration-500 group-hover/avatar:opacity-60" />
                    
                    {/* Gradient Squircle Frame */}
                    <div className="relative h-40 w-40 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-[3px] shadow-[0_24px_50px_rgba(0,0,0,0.4)] sm:h-44 sm:w-44">
                      {/* Inner Slate Gap */}
                      <div className="h-full w-full rounded-[21px] bg-[#0c1220] p-1">
                        {/* Content Box */}
                        <div className="h-full w-full overflow-hidden rounded-[17px] bg-slate-950 flex items-center justify-center">
                          {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.displayName} className="h-full w-full object-cover transition duration-500 group-hover/avatar:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-900/40 via-indigo-900/40 to-cyan-900/40">
                              <span className="bg-gradient-to-tr from-white to-slate-400 bg-clip-text text-5xl font-black tracking-tight text-transparent">
                                {profile.displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Pulse ring for active status */}
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-6 w-6 border-2 border-[#0c1220] bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0c1220] p-5 text-slate-300">
                    <div className="text-[30px] font-semibold leading-none text-slate-100">
                      {profile.displayName}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xl font-medium text-slate-100">
                      <span>{profile.headline || "Student Portfolio"}</span>
                      {profile.domain ? (
                        <>
                          <span className="text-slate-500">—</span>
                          <span className="text-base text-slate-400">{profile.domain}</span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                      {profile.domain ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                          {profile.domain}
                        </span>
                      ) : null}
                      {profile.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                          {profile.location}
                        </span>
                      ) : null}
                      {profile.institution ? (
                        <span className="inline-flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 text-cyan-300" />
                          {profile.institution.displayName}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Previously</div>
                      {previousEntries.length > 0 ? (
                        <div className="mt-3 space-y-1.5 text-sm">
                          {previousEntries.map((entry) => (
                            <div key={`${entry.company}-${entry.role}`} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3">
                              <span className="font-medium text-slate-200">{entry.company}</span>
                              <span className="text-slate-400">as {entry.role}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-400">No previous entries available.</div>
                      )}
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4 text-[30px] font-semibold leading-none text-slate-100">
                      Innovation Score <span className="text-[#48a9e6]">{profile.innovationScore}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Content with shortcuts */}
              <div className="space-y-4">
                  {/* Experience timeline */}
                  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-[34px] font-semibold leading-none text-slate-100">Experience</h3>
                      <span className="text-sm font-medium text-sky-600">Show Details</span>
                    </div>
                    {profile.experience.length > 0 ? (
                      <div className="relative mt-4 pl-10">
                        <div className="absolute bottom-2 left-3.5 top-2 w-px bg-slate-800" />
                        <div className="space-y-6">
                          {profile.experience.slice(0, 4).map((item, index) => (
                            <article key={item._id} className="relative border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
                              <span className={`absolute -left-10 top-1 h-4 w-4 rounded-full border-2 ${index === 0 ? "border-cyan-400" : "border-slate-600"} bg-slate-950`} />
                              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                <div>
                                  <div className="text-2xl font-medium text-slate-100">
                                    {item.title} <span className="mx-2 text-slate-500">—</span>
                                    <span className="text-xl text-slate-400">{item.company}</span>
                                  </div>
                                  {item.location ? <div className="mt-1 text-sm text-slate-400">{item.location}</div> : null}
                                </div>
                                <div className="text-right text-sm font-medium text-slate-400">
                                  {formatDate(item.startDate)} - {item.isCurrent ? "currently" : formatDate(item.endDate)}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                        {profile.experience.length > 4 ? (
                          <div className="mt-4 text-center">
                            <span className="text-sm font-medium text-sky-600">Show more</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-slate-400">No experience has been added yet.</div>
                    )}
                  </section>

                  {/* Skills + Featured */}
                  <section className="grid gap-4 lg:grid-cols-2">
                    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Skills</h3>
                      {profile.skills.length > 0 ? (
                        <ul className="mt-4 space-y-3 text-sm text-slate-400">
                          {profile.skills.slice(0, 6).map((skill) => (
                            <li key={`${skill.name}-${skill.source}`} className="flex items-center gap-2">
                              <span className="text-slate-500">*</span>
                              <span>{skill.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-4 text-sm text-slate-400">No skills added yet.</div>
                      )}
                    </article>
                    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Featured</h3>
                      {profile.portfolioProjects.length > 0 ? (
                        <ul className="mt-4 space-y-3">
                          {profile.portfolioProjects.slice(0, 4).map((project) => (
                            <li key={project._id} className="text-sm">
                              <div className="flex items-start gap-2 text-slate-200">
                                <span className="text-slate-500">*</span>
                                <span>{project.title}</span>
                              </div>
                              <div className="ml-4 mt-0.5 text-xs text-slate-500">
                                {project.description || project.techStack.slice(0, 3).join(", ")}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-4 text-sm text-slate-400">No featured work yet.</div>
                      )}
                    </article>
                  </section>

                  {/* Education */}
                  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Education</h3>
                    {profile.education.length > 0 ? (
                      <div className="mt-4 space-y-6">
                        {profile.education.slice(0, 3).map((item) => (
                          <article key={item._id} className="grid gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
                            <div className="text-xs text-slate-500">
                              {item.startYear ? `${item.startYear} - ${item.isCurrent ? "Present" : item.endYear ?? ""}` : ""}
                            </div>
                            <div>
                              <h4 className="text-2xl font-medium text-slate-100">{item.institution}</h4>
                              <p className="mt-1 text-sm text-slate-400">
                                {[item.degree, item.fieldOfStudy].filter(Boolean).join(", ")}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-slate-400">No education entries added yet.</div>
                    )}
                  </section>

                  {/* Startups */}
                  {profile.certifications.length > 0 ? (
                    <section className="rounded-2xl border border-slate-800 bg-slate-900">
                      <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="text-[34px] font-semibold leading-none text-slate-100">Certifications</h3>
                      </div>
                      <div>
                        {profile.certifications.map((cert) => (
                          <article key={cert._id} className="border-b border-slate-800 px-5 py-3 last:border-b-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-lg font-semibold text-slate-100">{cert.name}</h4>
                                <p className="mt-1 text-sm text-slate-400">{cert.issuingOrganization}</p>
                                <div className="mt-1 text-xs text-slate-500">
                                  {cert.issueDate ? `Issued ${formatDate(cert.issueDate)}` : ""}
                                  {cert.expiryDate ? ` · Expires ${formatDate(cert.expiryDate)}` : ""}
                                </div>
                              </div>
                              {cert.credentialUrl ? (
                                <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="text-cyan-200 hover:text-cyan-100">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
              </div>
            </div>

            {/* ── Right Sidebar ── */}
            <aside className="space-y-4">
              {/* Profile strength */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Profile strength</h3>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: "Innovation Score", value: profile.innovationScore },
                    { label: "Projects", value: profile.portfolioProjects.length },
                    { label: "Skills", value: profile.skills.length },
                    { label: "Certifications", value: profile.certifications.length },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="font-semibold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* GitHub signal */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">GitHub signal</h3>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: "Repositories", value: profile.githubStats.totalRepos },
                    { label: "Stars", value: profile.githubStats.totalStars },
                    { label: "Forks", value: profile.githubStats.totalForks },
                    { label: "Contributions/yr", value: profile.githubProof.commitCount30Days },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-semibold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent activity */}
              {profile.githubProof.recentActivity.length > 0 ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Recent activity</h3>
                  <div className="mt-3 space-y-3">
                    {profile.githubProof.recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="border-b border-slate-800/50 pb-2 last:border-b-0 last:pb-0">
                        <div className="text-sm font-medium text-slate-200">{activity.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {[activity.repoFullName, formatDateTime(activity.occurredAt)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Links */}
              {visibleSocialLinks.length > 0 ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Links</h3>
                  <div className="mt-3 space-y-2">
                    {visibleSocialLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StudentPortfolioViewPage() {
  const authUser = useAuthStore((state) => state.user);

  return (
    <DashboardLayout role={authUser?.role}>
      <StudentPortfolioViewContent />
    </DashboardLayout>
  );
}
