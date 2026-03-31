import { useMemo, useState, type ReactNode } from 'react';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  Eye,
  FolderKanban,
  GitFork,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
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

const tabs: Array<{ id: MarketplaceRole; label: string }> = [
  { id: 'mentor', label: 'Mentors' },
  { id: 'investor', label: 'Investors' },
  { id: 'recruiter', label: 'Recruiters' },
];

const roleCopy: Record<MarketplaceRole, string> = {
  mentor: 'Discover mentors with real public context across skills, experience highlights, and project work.',
  investor: 'Review investors with clearer sector fit, public links, and richer readiness signals before you connect.',
  recruiter: 'Browse recruiters with live jobs, fuller public profiles, and one-click applications from the same workspace.',
};

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
  const profileQuery = useQuery({
    queryKey: ['marketplace', 'profile', profileId],
    queryFn: () => marketplaceApi.getProfile(profileId!),
    enabled: open && Boolean(profileId),
  });
  const profile = profileQuery.data;
  const counts = profile ? getInsightCounts(profile) : null;

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

            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
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
  const jobsQuery = useQuery({
    queryKey: ['marketplace', 'recruiter-jobs', recruiterId],
    queryFn: () => recruiterApi.getPublicJobs(recruiterId),
    enabled: Boolean(recruiterId),
  });

  const applyToJob = async (jobId: string) => {
    try {
      await recruiterApi.applyToJob(jobId);
      await jobsQuery.refetch();
      onApplyFeedback('success', 'Applied! The recruiter can now contact you.');
    } catch {
      onApplyFeedback('error', 'Unable to apply to this job right now.');
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
        (jobsQuery.data ?? []).map((job) => (
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
                <Button variant="secondary" onClick={() => applyToJob(job._id)}>
                  Apply
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="text-sm text-slate-400">{recruiterName} has no active openings right now.</div>
      )}
    </div>
  );
}

export function Marketplace() {
  const [role, setRole] = useState<MarketplaceRole>('recruiter');
  const [search, setSearch] = useState('');
  const [expandedRecruiterId, setExpandedRecruiterId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['marketplace', role],
    queryFn: () => marketplaceApi.list(role),
  });

  const profileList = useMemo(
    () => (profilesQuery.data ?? []).filter((profile) => getMarketplaceSearchText(profile).includes(search.toLowerCase())),
    [profilesQuery.data, search],
  );

  const showBanner = (tone: 'success' | 'error', message: string) => {
    setBanner({ tone, message });
    window.setTimeout(() => setBanner(null), 3000);
  };

  return (
    <DashboardLayout role="student">
    <div className="space-y-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Student Marketplace
            </div>
            <h1 className="text-3xl font-bold text-white">Browse mentors, investors, and recruiters</h1>
            <p className="mt-2 max-w-3xl text-slate-400">{roleCopy[role]}</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people, companies, skills, or domains"
              className="pl-11"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
          <Card className="h-fit p-4">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRole(tab.id);
                    setExpandedRecruiterId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    role === tab.id
                      ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'recruiter' ? <BriefcaseBusiness className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            {profilesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : profileList.length === 0 ? (
              <Card className="p-8">
                <div className="max-w-2xl space-y-3">
                  <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">No Profiles Found</div>
                  <h2 className="text-2xl font-semibold text-white">No marketplace members match this search yet.</h2>
                  <p className="text-slate-400">
                    Try another keyword, domain, skill, or company name. Search now scans headlines, skills, work history,
                    education, and project summaries.
                  </p>
                </div>
              </Card>
            ) : (
              profileList.map((profile) => {
                const counts = getInsightCounts(profile);

                return (
                  <Card key={profile._id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <ProfileAvatar profile={profile} size="small" />
                        <div className="max-w-3xl">
                          <h3 className="text-xl font-semibold text-white">{profile.displayName}</h3>
                          <div className="mt-1 text-sm text-cyan-300 capitalize">{profile.role}</div>
                          {profile.headline ? <div className="mt-2 text-sm text-slate-200">{profile.headline}</div> : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
                              {profile.domain ?? 'General innovation support'}
                            </span>
                            {profile.location ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
                                <MapPin className="h-4 w-4 text-cyan-300" />
                                {profile.location}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
                              {counts.experience} experience items
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
                              {counts.portfolioProjects} projects
                            </span>
                          </div>
                          <p className="mt-3 max-w-2xl text-sm text-slate-300">
                            {profile.bio ?? 'Public profile details will appear here as more marketplace members complete their profiles.'}
                          </p>
                          {(profile.skills ?? []).length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {profile.skills?.map((skill) => (
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
                      <div className="flex items-center gap-2">
                        {role === 'recruiter' ? (
                          <Button
                            variant="secondary"
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
                        <Button onClick={() => setSelectedProfileId(profile._id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Profile
                        </Button>
                      </div>
                    </div>

                    {role === 'recruiter' && expandedRecruiterId === profile._id ? (
                      <RecruiterJobCard
                        recruiterId={profile._id}
                        recruiterName={profile.displayName}
                        onApplyFeedback={showBanner}
                      />
                    ) : null}
                  </Card>
                );
              })
            )}
          </div>
        </div>
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
    </div>
    </DashboardLayout>
  );
}
