import { startTransition, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  ExternalLink,
  Eye,
  FolderKanban,
  GitFork,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { marketplaceApi, MarketplaceProfile, MarketplaceRole } from '../../api/marketplace.api';
import { recruiterApi } from '../../api/recruiter.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { StartupSectionTabs } from '../startup/StartupSectionTabs';
import { StudentWorkspaceTabs } from './StudentWorkspaceTabs';

const tabs: Array<{
  id: MarketplaceRole;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  icon: typeof Compass;
}> = [
  {
    id: 'mentor',
    label: 'Mentors',
    eyebrow: 'Guidance',
    description: 'Find operators and advisors who can unblock decisions on product, execution, and launch.',
    accent: 'from-cyan-400/20 via-cyan-400/5 to-transparent',
    icon: Compass,
  },
  {
    id: 'investor',
    label: 'Investors',
    eyebrow: 'Capital',
    description: 'Review investors by sector fit, public proof, and startup readiness signals before outreach.',
    accent: 'from-emerald-400/20 via-emerald-400/5 to-transparent',
    icon: Building2,
  },
  {
    id: 'recruiter',
    label: 'Recruiters',
    eyebrow: 'Hiring',
    description: 'Browse recruiters with live opportunities and move into applications or direct messages quickly.',
    accent: 'from-amber-400/20 via-amber-400/5 to-transparent',
    icon: BriefcaseBusiness,
  },
];

const roleCopy: Record<MarketplaceRole, string> = {
  mentor: 'Discover mentors with real public context across skills, experience highlights, and project work.',
  investor: 'Review investors with clearer sector fit, public links, and richer readiness signals before you connect.',
  recruiter: 'Browse recruiters with live jobs, fuller public profiles, and one-click applications from the same workspace.',
};

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatMonthYear = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (startDate?: string, endDate?: string | null, isCurrent?: boolean) => {
  const start = formatMonthYear(startDate);
  const end = isCurrent ? 'Present' : formatMonthYear(endDate) ?? 'Recent';

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end ?? null;
};

const getMarketplaceSearchText = (profile: MarketplaceProfile) =>
  [
    profile.displayName,
    profile.role,
    profile.domain,
    profile.headline,
    profile.location,
    profile.bio,
    ...(profile.skills ?? []).map((skill) => `${skill.name} ${skill.level}`),
    ...(profile.experienceHighlights ?? []).map((experience) =>
      [experience.title, experience.company, experience.location, experience.description, ...experience.skills].join(' '),
    ),
    ...(profile.educationHighlights ?? []).map((education) =>
      [education.institution, education.degree, education.fieldOfStudy, education.grade].join(' '),
    ),
    ...(profile.portfolioHighlights ?? []).map((project) =>
      [project.title, project.description, ...project.techStack, ...project.languages].join(' '),
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getInsightCounts = (profile: MarketplaceProfile) => ({
  skills: profile.insightCounts?.skills ?? profile.skills?.length ?? 0,
  experience: profile.insightCounts?.experience ?? profile.experienceHighlights?.length ?? 0,
  education: profile.insightCounts?.education ?? profile.educationHighlights?.length ?? 0,
  portfolioProjects:
    profile.insightCounts?.portfolioProjects ?? profile.portfolioHighlights?.length ?? 0,
});

function ProfileAvatar({
  profile,
  size = 'large',
}: {
  profile: MarketplaceProfile;
  size?: 'small' | 'large';
}) {
  const containerClassName =
    size === 'small'
      ? 'h-14 w-14 rounded-2xl text-lg'
      : 'h-16 w-16 rounded-3xl text-xl';

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-cyan-500 to-emerald-500 font-bold text-white ${containerClassName}`}
    >
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.displayName}
          className={`object-cover ${containerClassName}`}
        />
      ) : (
        profile.displayName.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-300">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function ProfileLinkChips({ profile }: { profile: MarketplaceProfile }) {
  const linkItems = [
    profile.links?.websiteUrl
      ? { href: profile.links.websiteUrl, label: 'Website', icon: <Globe className="h-4 w-4" /> }
      : null,
    profile.links?.githubUrl
      ? { href: profile.links.githubUrl, label: 'GitHub', icon: <Github className="h-4 w-4" /> }
      : null,
    profile.links?.linkedinUrl
      ? { href: profile.links.linkedinUrl, label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: ReactNode }>;

  if (linkItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {linkItems.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-white"
        >
          {link.icon}
          <span>{link.label}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

function MarketplaceProfileDrawer({
  profileId,
  open,
  onClose,
}: {
  profileId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ['marketplace', 'profile', profileId],
    queryFn: () => marketplaceApi.getProfile(profileId!),
    enabled: open && Boolean(profileId),
  });
  const profile = profileQuery.data;
  const counts = profile ? getInsightCounts(profile) : null;

  const getQueryType = (role: string) => {
    switch (role) {
      case 'mentor': return 'project_mentor';
      case 'investor': return 'investor';
      case 'recruiter': return 'recruiter';
      default: return 'general';
    }
  };

  const handleMessage = () => {
    if (profile) {
      const storageKey = `dm_first_contact_${profile._id}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'true');
      }
      navigate(`/dashboard/messages/${profile._id}?queryType=${getQueryType(profile.role)}`);
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <button type="button" aria-label="Close profile" className="flex-1" onClick={onClose} />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 shadow-2xl shadow-black/40">
        {profileQuery.isLoading || !profile || !counts ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar profile={profile} />
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Marketplace Profile</div>
                  <h2 className="mt-2 text-2xl font-bold text-white">{profile.displayName}</h2>
                  <div className="mt-2 text-sm capitalize text-slate-400">{profile.role}</div>
                  {profile.headline ? (
                    <p className="mt-3 max-w-xl text-sm text-slate-300">{profile.headline}</p>
                  ) : null}
                  {profile.location ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="h-4 w-4 text-cyan-300" />
                      <span>{profile.location}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleMessage} className="flex-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Skills</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.skills}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Experience</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.experience}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Education</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.education}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects</div>
                <div className="mt-3 text-2xl font-semibold text-white">{counts.portfolioProjects}</div>
              </Card>
            </div>

            <ProfileSection title="Overview" icon={<Sparkles className="h-4 w-4" />}>
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Domain</div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {profile.domain ?? 'General innovation support'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">About</div>
                  <p className="mt-2 leading-7 text-slate-300">
                    {profile.bio ??
                      'This member has not added a public bio yet, but their profile is active in the marketplace.'}
                  </p>
                </div>
                <ProfileLinkChips profile={profile} />
              </div>
            </ProfileSection>

            {(profile.skills ?? []).length > 0 ? (
              <ProfileSection title="Skills" icon={<Code2 className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  {profile.skills?.map((skill) => (
                    <span
                      key={`${skill.name}-${skill.level}`}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                    >
                      {skill.name}
                      <span className="ml-2 text-xs uppercase tracking-[0.18em] text-cyan-300">{skill.level}</span>
                    </span>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.experienceHighlights ?? []).length > 0 ? (
              <ProfileSection title="Experience Highlights" icon={<BriefcaseBusiness className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.experienceHighlights?.map((experience) => (
                    <div
                      key={`${experience.title}-${experience.company}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-white">{experience.title}</div>
                          <div className="mt-1 text-sm text-cyan-300">{experience.company}</div>
                        </div>
                        <div className="text-sm text-slate-400">
                          {formatDateRange(experience.startDate, experience.endDate, experience.isCurrent)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                        <span className="capitalize">{experience.type.replace(/_/g, ' ')}</span>
                        {experience.location ? <span>{experience.location}</span> : null}
                      </div>
                      {experience.description ? (
                        <p className="mt-3 text-sm leading-6 text-slate-300">{experience.description}</p>
                      ) : null}
                      {experience.skills.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {experience.skills.map((skill) => (
                            <span
                              key={`${experience.title}-${skill}`}
                              className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.educationHighlights ?? []).length > 0 ? (
              <ProfileSection title="Education" icon={<GraduationCap className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.educationHighlights?.map((education) => (
                    <div
                      key={`${education.institution}-${education.degree ?? ''}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="text-base font-semibold text-white">{education.institution}</div>
                      <div className="mt-1 text-sm text-cyan-300">
                        {[education.degree, education.fieldOfStudy].filter(Boolean).join(' in ') || 'Academic profile'}
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {education.startYear ?? 'Start'} - {education.isCurrent ? 'Present' : education.endYear ?? 'Recent'}
                      </div>
                      {education.grade ? <div className="mt-2 text-sm text-slate-300">Grade: {education.grade}</div> : null}
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {(profile.portfolioHighlights ?? []).length > 0 ? (
              <ProfileSection title="Projects" icon={<FolderKanban className="h-4 w-4" />}>
                <div className="space-y-3">
                  {profile.portfolioHighlights?.map((project) => (
                    <div key={project.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-white">{project.title}</div>
                          {project.description ? (
                            <p className="mt-2 text-sm leading-6 text-slate-300">{project.description}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {project.liveUrl ? (
                            <a
                              href={project.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:text-white"
                            >
                              <Globe className="h-4 w-4" />
                              Live
                            </a>
                          ) : null}
                          {project.repoUrl ? (
                            <a
                              href={project.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:text-white"
                            >
                              <Github className="h-4 w-4" />
                              Repo
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {project.techStack.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.techStack.map((tech) => (
                            <span
                              key={`${project.title}-${tech}`}
                              className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="h-4 w-4 text-cyan-300" />
                          {project.stars} stars
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <GitFork className="h-4 w-4 text-cyan-300" />
                          {project.forks} forks
                        </span>
                        {project.languages.length > 0 ? <span>{project.languages.join(', ')}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {profile.githubStats ? (
              <ProfileSection title="GitHub Footprint" icon={<Github className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Repos</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalRepos}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Stars</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalStars}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Forks</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.totalForks}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">1Y Contributions</div>
                    <div className="mt-2 text-xl font-semibold text-white">{profile.githubStats.contributionsLastYear}</div>
                  </div>
                </div>
                {profile.githubStats.topLanguages.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.githubStats.topLanguages.map((language) => (
                      <span
                        key={language.language}
                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                      >
                        {language.language}
                        <span className="ml-2 text-xs text-cyan-300">{language.percentage}%</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </ProfileSection>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function RecruiterJobCard({
  recruiterId,
  recruiterName,
  onApplyFeedback,
}: {
  recruiterId: string;
  recruiterName: string;
  onApplyFeedback: (tone: 'success' | 'error', message: string) => void;
}) {
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [pendingJobIds, setPendingJobIds] = useState<string[]>([]);
  const jobsQuery = useQuery({
    queryKey: ['marketplace', 'recruiter-jobs', recruiterId],
    queryFn: () => recruiterApi.getPublicJobs(recruiterId),
    enabled: Boolean(recruiterId),
  });

  const applyToJob = async (jobId: string) => {
    if (appliedJobIds.includes(jobId) || pendingJobIds.includes(jobId)) {
      return;
    }

    setPendingJobIds((current) => [...current, jobId]);

    try {
      await recruiterApi.applyToJob(jobId);
      setAppliedJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
      await jobsQuery.refetch();
      onApplyFeedback('success', 'Applied! The recruiter can now contact you.');
    } catch {
      onApplyFeedback('error', 'Unable to apply to this job right now.');
    } finally {
      setPendingJobIds((current) => current.filter((id) => id !== jobId));
    }
  };

  if (jobsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
      <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Open Job Posts</div>
      {(jobsQuery.data ?? []).length > 0 ? (
        (jobsQuery.data ?? []).map((job) => {
          const hasApplied = Boolean(job.hasApplied) || appliedJobIds.includes(job._id);
          const isPending = pendingJobIds.includes(job._id);

          return (
            <Card key={job._id} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold text-white">{job.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {job.company} - {job.location} - {job.type}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{job.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => applyToJob(job._id)}
                    disabled={hasApplied || isPending}
                    className={hasApplied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/40 hover:text-emerald-200' : ''}
                  >
                    {isPending ? 'Applying...' : hasApplied ? 'Applied' : 'Apply'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      ) : (
        <div className="text-sm text-slate-400">{recruiterName} has no active openings right now.</div>
      )}
    </div>
  );
}

export function Marketplace() {
  const navigate = useNavigate();
  const [role, setRole] = useState<MarketplaceRole>('recruiter');
  const [search, setSearch] = useState('');
  const [expandedRecruiterId, setExpandedRecruiterId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const activeTab = tabs.find((tab) => tab.id === role) ?? tabs[0];
  const ActiveRoleIcon = activeTab.icon;

  const profilesQuery = useQuery({
    queryKey: ['marketplace', role],
    queryFn: () => marketplaceApi.list(role),
  });

  const profileList = useMemo(() => {
    const source = profilesQuery.data ?? [];

    if (!deferredSearch) {
      return source;
    }

    return source.filter((profile) => getMarketplaceSearchText(profile).includes(deferredSearch));
  }, [deferredSearch, profilesQuery.data]);

  const marketplaceSummary = useMemo(() => {
    const profiles = profilesQuery.data ?? [];
    const domains = new Set<string>();
    let totalExperience = 0;
    let totalProjects = 0;
    let totalSkills = 0;

    for (const profile of profiles) {
      if (profile.domain) {
        domains.add(profile.domain);
      }

      const counts = getInsightCounts(profile);
      totalExperience += counts.experience;
      totalProjects += counts.portfolioProjects;
      totalSkills += counts.skills;
    }

    return {
      liveResults: profiles.length,
      representedDomains: domains.size,
      experienceSignals: totalExperience,
      portfolioProjects: totalProjects,
      trackedSkills: totalSkills,
    };
  }, [profilesQuery.data]);

  const spotlightProfile = profileList[0] ?? null;

  const showBanner = (tone: 'success' | 'error', message: string) => {
    setBanner({ tone, message });
    window.setTimeout(() => setBanner(null), 3000);
  };

  return (
    <DashboardLayout role="student">
      <div className="mx-auto max-w-7xl space-y-8 text-white">
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Student Workspace</div>
          <StudentWorkspaceTabs />
        </section>

        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Startup Workspace</div>
          <StartupSectionTabs />
        </section>

        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070816] px-6 py-7 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:px-8">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeTab.accent}`} />
          <div className="pointer-events-none absolute -right-12 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.1fr),380px] xl:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Student Marketplace
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-slate-400">
                  <ActiveRoleIcon className="h-4 w-4" />
                  <span>{activeTab.eyebrow}</span>
                </div>
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  Find the right {activeTab.label.toLowerCase()} without leaving your startup workspace
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300">
                  {roleCopy[role]} Search scans public bios, skills, experience, education, and project work so discovery
                  stays fast while the startup navigation above stays unchanged.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(marketplaceSummary.liveResults)}</span> live profiles
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(marketplaceSummary.representedDomains)}</span> domains
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(marketplaceSummary.portfolioProjects)}</span> portfolio
                  projects
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-white">{formatCompactNumber(marketplaceSummary.experienceSignals)}</span> experience
                  signals
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur">
              <div className="mb-3 text-sm font-medium text-slate-300">Search the current lane</div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => {
                    const { value } = event.target;
                    startTransition(() => setSearch(value));
                  }}
                  placeholder="Search people, companies, skills, or domains"
                  className="rounded-2xl border-white/10 bg-slate-950/80 py-3 pl-12 pr-4 focus:border-cyan-400/50"
                />
              </label>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Current lane: <span className="text-slate-200">{activeTab.label}</span>. Search remains local to this lane
                so switching between mentors, investors, and recruiters stays predictable.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0d1d]">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Browse By Type</div>
              <div className="mt-2 text-lg font-semibold text-white">Marketplace lanes</div>
            </div>

            <div className="p-3">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === role;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        startTransition(() => {
                          setRole(tab.id);
                          setExpandedRecruiterId(null);
                        })
                      }
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                        isActive
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-white'
                          : 'border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                            isActive ? 'bg-white/10 text-cyan-200' : 'bg-white/5 text-slate-300'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="space-y-1">
                          <span className="block text-sm font-semibold">{tab.label}</span>
                          <span className="block text-xs uppercase tracking-[0.22em] text-slate-500">{tab.eyebrow}</span>
                          <span className="block text-xs leading-5 text-slate-400">{tab.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Current lens</div>
                {spotlightProfile ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{spotlightProfile.displayName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-cyan-300">{spotlightProfile.role}</div>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      {spotlightProfile.headline ?? spotlightProfile.bio ?? 'Public profile details are available in the full profile view.'}
                    </p>
                    <Button
                      variant="secondary"
                      className="w-full justify-center border-white/10 bg-white/5 hover:border-white/20"
                      onClick={() => setSelectedProfileId(spotlightProfile._id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Spotlight Profile
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Switch lanes or clear the search input to bring live marketplace results back into view.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-[#0a0d1d] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Directory Results</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {profilesQuery.isLoading ? 'Loading marketplace profiles' : `${profileList.length} results in ${activeTab.label}`}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Search indexes headlines, skills, work history, education, and project summaries so the directory stays
                    useful even as profiles get richer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    {formatCompactNumber(marketplaceSummary.trackedSkills)} tracked skills
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    {deferredSearch ? `Filtered by "${search.trim()}"` : 'No active text filter'}
                  </span>
                </div>
              </div>
            </div>

            {profilesQuery.isLoading ? (
              <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-[#0a0d1d] px-6 py-16">
                <Spinner />
              </div>
            ) : null}

            {profilesQuery.isError ? (
              <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-100">
                Unable to load marketplace profiles right now.
              </div>
            ) : null}

            {!profilesQuery.isLoading && !profilesQuery.isError && profileList.length === 0 ? (
              <Card className="rounded-[28px] border-white/10 bg-[#0a0d1d] p-8">
                <div className="max-w-2xl space-y-3">
                  <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">No Profiles Found</div>
                  <h2 className="text-2xl font-semibold text-white">No marketplace members match this search yet.</h2>
                  <p className="text-slate-400">
                    Try another keyword, domain, skill, or company name. Search now scans headlines, skills, work history,
                    education, and project summaries.
                  </p>
                </div>
              </Card>
            ) : null}

            {!profilesQuery.isLoading &&
              !profilesQuery.isError &&
              profileList.map((profile) => {
                const counts = getInsightCounts(profile);
                const skillPreview = (profile.skills ?? []).slice(0, 6);

                return (
                  <article
                    key={profile._id}
                    className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1020]/95 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.28)] [content-visibility:auto] sm:p-6"
                  >
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${activeTab.accent}`} />

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),260px]">
                      <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <ProfileAvatar profile={profile} size="small" />

                          <div className="min-w-0 flex-1">
                            <div className="min-w-0">
                              <h3 className="truncate text-2xl font-semibold text-white">{profile.displayName}</h3>
                              <div className="mt-1 text-sm uppercase tracking-[0.24em] text-cyan-300">{profile.role}</div>
                              {profile.headline ? (
                                <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{profile.headline}</div>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                {profile.domain ?? 'General innovation support'}
                              </span>
                              {profile.location ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                  <MapPin className="h-4 w-4 text-cyan-300" />
                                  {profile.location}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                {counts.experience} experience items
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                {counts.portfolioProjects} projects
                              </span>
                            </div>

                            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                              {profile.bio ?? 'Public profile details will appear here as more marketplace members complete their profiles.'}
                            </p>

                            {skillPreview.length > 0 ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {skillPreview.map((skill) => (
                                  <span
                                    key={`${profile._id}-${skill.name}`}
                                    className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
                                  >
                                    {skill.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-4">
                              <ProfileLinkChips profile={profile} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Skills', value: counts.skills },
                            { label: 'Experience', value: counts.experience },
                            { label: 'Education', value: counts.education },
                            { label: 'Projects', value: counts.portfolioProjects },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{stat.label}</div>
                              <div className="mt-2 text-xl font-semibold text-white">{stat.value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            className="w-full justify-center"
                            onClick={() => {
                              const storageKey = `dm_first_contact_${profile._id}`;
                              if (!localStorage.getItem(storageKey)) {
                                localStorage.setItem(storageKey, 'true');
                              }
                              navigate(`/dashboard/messages/${profile._id}`);
                            }}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Message
                          </Button>
                          <Button
                            variant="secondary"
                            className="w-full justify-center border-white/10 bg-white/5 hover:border-white/20"
                            onClick={() => setSelectedProfileId(profile._id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Profile
                          </Button>
                          {role === 'recruiter' ? (
                            <Button
                              variant="secondary"
                              className="w-full justify-center border-white/10 bg-white/5 hover:border-white/20"
                              onClick={() => setExpandedRecruiterId(expandedRecruiterId === profile._id ? null : profile._id)}
                            >
                              {expandedRecruiterId === profile._id ? (
                                <ChevronUp className="mr-2 h-4 w-4" />
                              ) : (
                                <ChevronDown className="mr-2 h-4 w-4" />
                              )}
                              {expandedRecruiterId === profile._id ? 'Hide Jobs' : 'View Jobs'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {role === 'recruiter' && expandedRecruiterId === profile._id ? (
                      <RecruiterJobCard
                        recruiterId={profile._id}
                        recruiterName={profile.displayName}
                        onApplyFeedback={showBanner}
                      />
                    ) : null}
                  </article>
                );
              })}
          </div>
        </section>
      </div>

      <MarketplaceProfileDrawer
        profileId={selectedProfileId}
        open={Boolean(selectedProfileId)}
        onClose={() => setSelectedProfileId(null)}
      />
      {banner ? (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl ${
            banner.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          }`}
        >
          {banner.message}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
