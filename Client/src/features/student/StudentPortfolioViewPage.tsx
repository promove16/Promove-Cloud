import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  ExternalLink,
  Github,
  GraduationCap,
  Link2,
  Linkedin,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { userApi } from '../../api/user.api';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { useAuthStore } from '../../store/authStore';
import { getMarketplaceBasePath } from '../marketplace/navigation';
import {
  PortfolioViewerActionButton,
  PortfolioViewerEmpty as Empty,
  PortfolioViewerHero,
  PortfolioViewerPageShell,
  PortfolioViewerSection as Section,
  PortfolioViewerStatCard as StatCard,
} from '../profile/PortfolioViewerShell';

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function StudentPortfolioViewContent({ userId: userIdOverride }: { userId?: string } = {}) {
  const params = useParams<{ userId?: string; entityType?: string; entityId?: string }>();
  const userId =
    userIdOverride ??
    params.userId ??
    (params.entityType === 'student' ? params.entityId ?? '' : '');
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const marketplacePath = getMarketplaceBasePath(authUser?.role);
  const profileQuery = useQuery({
    queryKey: ['student-portfolio-view', userId],
    queryFn: () => userApi.getStudentPortfolioView(userId),
    enabled: userId.trim().length > 0,
  });

  const profile = profileQuery.data;
  const visibleSocialLinks = useMemo(
    () =>
      [
        { label: 'LinkedIn', url: profile?.linkedinUrl, icon: Linkedin },
        { label: 'GitHub', url: profile?.githubUrl, icon: Github },
        { label: 'Website', url: profile?.websiteUrl, icon: Link2 },
      ].filter((item): item is { label: string; url: string; icon: typeof Linkedin } => Boolean(item.url)),
    [profile],
  );

  const handleMessage = () => {
    if (!profile?._id) {
      return;
    }
    const storageKey = `dm_first_contact_${profile._id}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, 'true');
    }
    navigate(`/dashboard/messages/${profile._id}`);
  };

  return (
    <PortfolioViewerPageShell
      backTo={marketplacePath}
      canMessage={Boolean(profile)}
      onMessage={handleMessage}
      loading={profileQuery.isLoading}
      loadingLabel="Loading student portfolio..."
      error={!profileQuery.isLoading && (profileQuery.isError || !profile)}
      errorLabel="This student portfolio is not available for your role or could not be loaded."
    >
      {profile ? (
        <>
          <PortfolioViewerHero
            cover={
              <div className="relative h-48 overflow-hidden rounded-t-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(135deg,_#0f172a,_#111827,_#020617)]">
                {profile.avatarWallpaper ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-75"
                    style={{ backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.28), rgba(15, 23, 42, 0.54)), url(${profile.avatarWallpaper})` }}
                  />
                ) : null}
              </div>
            }
            avatar={
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-slate-900 bg-slate-800 text-4xl font-semibold text-cyan-200 shadow-sm sm:h-40 sm:w-40 sm:text-5xl">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.displayName} className="h-full w-full object-cover" />
                ) : (
                  profile.displayName
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
            }
            title={profile.displayName}
            badges={
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Read-only portfolio
                </span>
                {profile.verifiedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </>
            }
            subtitle={profile.headline || profile.domain || 'Student portfolio'}
            description={profile.bio || 'This student has not added a detailed overview yet.'}
            meta={
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                {profile.domain ? (
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    {profile.domain}
                  </span>
                ) : null}
                {profile.location ? (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    {profile.location}
                  </span>
                ) : null}
                {profile.institution ? (
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-cyan-300" />
                    {profile.institution.displayName}
                  </span>
                ) : null}
              </div>
            }
            actions={
              <>
                {visibleSocialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <PortfolioViewerActionButton key={link.label} href={link.url}>
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </PortfolioViewerActionButton>
                  );
                })}
              </>
            }
            aside={
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Innovation Score" value={profile.innovationScore} />
                <StatCard label="Projects" value={profile.portfolioProjects.length} />
                <StatCard label="Skills" value={profile.skills.length} />
                <StatCard label="30-Day Commits" value={profile.githubProof.commitCount30Days} />
              </div>
            }
          />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),360px]">
                <div className="space-y-6">
                  <Section title="Projects">
                    {profile.portfolioProjects.length > 0 ? (
                      <div className="space-y-4">
                        {profile.portfolioProjects.map((project) => (
                          <article key={project._id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-white">{project.title}</h3>
                                {project.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{project.description}</p> : null}
                              </div>
                              {project.stars > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  {project.stars}
                                </span>
                              ) : null}
                            </div>
                            {project.techStack.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {project.techStack.slice(0, 8).map((item) => (
                                  <span key={`${project._id}-${item}`} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-cyan-200">
                              {project.repoUrl ? <a href={project.repoUrl} target="_blank" rel="noreferrer" className="hover:underline">Repository</a> : null}
                              {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noreferrer" className="hover:underline">Live demo</a> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>No portfolio projects are available yet.</Empty>
                    )}
                  </Section>

                  <Section title="Experience">
                    {profile.experience.length > 0 ? (
                      <div className="space-y-4">
                        {profile.experience.map((experience) => (
                          <article key={experience._id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                              <Briefcase className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white">{experience.title}</h3>
                              <div className="text-sm text-slate-200">{experience.company}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {formatDate(experience.startDate)} - {experience.isCurrent ? 'Present' : formatDate(experience.endDate)}
                                {experience.location ? ` . ${experience.location}` : ''}
                              </div>
                              {experience.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{experience.description}</p> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>No experience has been added yet.</Empty>
                    )}
                  </Section>

                  <Section title="Education">
                    {profile.education.length > 0 ? (
                      <div className="space-y-4">
                        {profile.education.map((education) => (
                          <article key={education._id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                              <GraduationCap className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white">{education.institution}</h3>
                              <div className="text-sm text-slate-200">{[education.degree, education.fieldOfStudy].filter(Boolean).join(', ')}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {education.startYear ? `${education.startYear} - ` : ''}
                                {education.isCurrent ? 'Present' : education.endYear ?? ''}
                                {education.grade ? ` . Grade: ${education.grade}` : ''}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>No education entries are available yet.</Empty>
                    )}
                  </Section>

                  <Section title="Licenses & certifications">
                    {profile.certifications.length > 0 ? (
                      <div className="space-y-4">
                        {profile.certifications.map((certification) => (
                          <article key={certification._id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                              <Award className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold text-white">{certification.name}</h3>
                                  <div className="text-sm text-slate-200">{certification.issuingOrganization}</div>
                                  <div className="mt-1 text-sm text-slate-400">
                                    {certification.issueDate ? `Issued ${formatDate(certification.issueDate)}` : ''}
                                    {certification.expiryDate ? ` . Expires ${formatDate(certification.expiryDate)}` : ''}
                                  </div>
                                </div>
                                {certification.credentialUrl ? (
                                  <a href={certification.credentialUrl} target="_blank" rel="noreferrer" className="text-cyan-200 hover:underline">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>No certifications have been added yet.</Empty>
                    )}
                  </Section>
                </div>

                <aside className="space-y-6">
                  <Section title="Skills">
                    {profile.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill) => (
                          <span key={`${skill.name}-${skill.source}`} className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Empty>No skills are available yet.</Empty>
                    )}
                  </Section>

                  <Section title="GitHub signal">
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard label="Repos" value={profile.githubStats.totalRepos} />
                      <StatCard label="Stars" value={profile.githubStats.totalStars} />
                      <StatCard label="Pull Requests" value={profile.githubProof.pullRequests30Days} />
                      <StatCard label="Active Days" value={profile.githubProof.activeDays30Days} />
                    </div>
                  </Section>

                  <Section title="Recent activity">
                    {profile.githubProof.recentActivity.length > 0 ? (
                      <div className="space-y-3">
                        {profile.githubProof.recentActivity.slice(0, 6).map((activity) => (
                          <article key={activity.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <h3 className="font-semibold text-white">{activity.title}</h3>
                            <p className="mt-1 text-sm text-slate-300">{activity.summary}</p>
                            <div className="mt-2 text-xs text-slate-500">
                              {[activity.repoFullName, formatDateTime(activity.occurredAt)].filter(Boolean).join(' . ')}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>No recent public GitHub activity is available yet.</Empty>
                    )}
                  </Section>
                </aside>
              </div>
        </>
      ) : null}
    </PortfolioViewerPageShell>
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
